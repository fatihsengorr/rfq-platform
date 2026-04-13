"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assignRfqToPricingUser,
  createQuoteRevision,
  decideQuoteApproval,
  isApiClientError,
  reviseRfqRequest,
} from "../../api";
import { setFlashNotice } from "../../../lib/flash";
import { uploadFilePresigned } from "../../../lib/upload";
import type { ActionResult } from "../../../lib/action-result";

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_ATTACHMENT_FILES = 10;

function parseFiles(formData: FormData, key: string) {
  return formData.getAll(key).filter((item): item is File => item instanceof File && item.size > 0);
}

function hasOversizedFile(files: File[]) {
  return files.some((file) => file.size > MAX_ATTACHMENT_BYTES);
}

function revalidateRfq(rfqId: string) {
  revalidatePath("/");
  revalidatePath("/requests");
  revalidatePath(`/requests/${rfqId}`);
}

function handleAuthRedirect(error: unknown): void {
  if (isApiClientError(error) && error.code === "UNAUTHORIZED") {
    redirect("/login");
  }
}

async function handleRfqNotFound(error: unknown): Promise<boolean> {
  if (isApiClientError(error) && error.code === "RFQ_NOT_FOUND") {
    await setFlashNotice("/requests", "rfq_not_found");
    redirect("/requests");
  }
  return false;
}

/* ── Revise Request ────────────────────────────────────── */

export async function reviseRequestAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const rfqId = String(formData.get("rfqId") ?? "").trim();
  const projectName = String(formData.get("projectName") ?? "").trim();
  const requestedBy = String(formData.get("requestedBy") ?? "").trim();
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();
  const projectDetails = String(formData.get("projectDetails") ?? "").trim();

  if (!rfqId || !projectName || !requestedBy || !deadlineRaw || !projectDetails) {
    return { status: "error", message: "All fields are required." };
  }

  try {
    const deadline = new Date(deadlineRaw).toISOString();
    await reviseRfqRequest(rfqId, { projectName, requestedBy, deadline, projectDetails });
    revalidateRfq(rfqId);
    return { status: "success", message: "RFQ request details were revised." };
  } catch (error) {
    handleAuthRedirect(error);
    await handleRfqNotFound(error);

    if (isApiClientError(error)) {
      if (error.code === "FORBIDDEN") return { status: "error", message: "Only London users can revise request details." };
      if (error.code === "INVALID_REQUEST") return { status: "error", message: "Request revision input is invalid." };
      if (error.code === "NETWORK_ERROR") return { status: "error", message: "API is unreachable. Please check backend status." };
    }

    return { status: "error", message: "RFQ request revision failed." };
  }
}

/* ── Assign Pricing User ──────────────────────────────── */

export async function assignPricingUserAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const rfqId = String(formData.get("rfqId") ?? "").trim();
  const assignedPricingUserId = String(formData.get("assignedPricingUserId") ?? "").trim();

  if (!rfqId || !assignedPricingUserId) {
    return { status: "error", message: "Please select a pricing user." };
  }

  try {
    await assignRfqToPricingUser(rfqId, { assignedPricingUserId });
    revalidateRfq(rfqId);
    return { status: "success", message: "Istanbul pricing assignment has been saved." };
  } catch (error) {
    handleAuthRedirect(error);
    await handleRfqNotFound(error);

    if (isApiClientError(error)) {
      if (error.code === "FORBIDDEN") return { status: "error", message: "Only Istanbul manager can assign RFQs." };
      if (error.code === "INVALID_REQUEST") return { status: "error", message: "Assignment input is invalid." };
      if (error.code === "NETWORK_ERROR") return { status: "error", message: "API is unreachable. Please check backend status." };
    }

    return { status: "error", message: "Assignment failed." };
  }
}

/* ── Upload Request Attachments ───────────────────────── */

export async function uploadRequestAttachmentsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const rfqId = String(formData.get("rfqId") ?? "").trim();
  const files = parseFiles(formData, "requestFiles");

  if (!rfqId || files.length === 0) {
    return { status: "error", message: "Please select at least one file." };
  }

  if (files.length > MAX_ATTACHMENT_FILES) {
    return { status: "error", message: "You can upload up to 10 files at once." };
  }

  if (hasOversizedFile(files)) {
    return { status: "error", message: "Attachment is too large. Max size is 50 MB per file." };
  }

  try {
    for (const file of files) {
      await uploadFilePresigned(rfqId, file);
    }
    revalidateRfq(rfqId);
    return { status: "success", message: files.length === 1 ? "Attachment uploaded successfully." : "Attachments uploaded successfully." };
  } catch (error) {
    handleAuthRedirect(error);
    await handleRfqNotFound(error);

    if (isApiClientError(error)) {
      if (error.code === "ATTACHMENT_TOO_LARGE") return { status: "error", message: "Attachment is too large. Max size is 50 MB per file." };
      if (error.code === "ATTACHMENT_UNSUPPORTED") return { status: "error", message: "Unsupported file type. Allowed: PDF, image, and CAD files." };
      if (error.code === "INVALID_REQUEST") return { status: "error", message: "Attachment request is invalid." };
      if (error.code === "FORBIDDEN") return { status: "error", message: "You are not allowed to upload these attachments." };
      if (error.code === "NETWORK_ERROR" || error.code === "STORAGE_ERROR") return { status: "error", message: "API is unreachable. Please check backend status." };
    }

    return { status: "error", message: "Attachment upload failed." };
  }
}

/* ── Create Quote Revision ────────────────────────────── */

export async function createQuoteRevisionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const rfqId = String(formData.get("rfqId") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim() as "GBP" | "EUR" | "USD" | "TRY";
  const totalAmountRaw = String(formData.get("totalAmount") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const autoSubmitForApproval = formData.get("autoSubmitForApproval") === "on";
  const quoteFiles = parseFiles(formData, "quoteFiles");

  if (!rfqId || !currency || !totalAmountRaw || !notes) {
    return { status: "error", message: "All fields are required." };
  }

  if (quoteFiles.length > MAX_ATTACHMENT_FILES) {
    return { status: "error", message: "You can upload up to 10 files at once." };
  }

  if (hasOversizedFile(quoteFiles)) {
    return { status: "error", message: "Attachment is too large. Max size is 50 MB per file." };
  }

  const totalAmount = Number(totalAmountRaw);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { status: "error", message: "Total amount must be a positive number." };
  }

  try {
    const created = await createQuoteRevision(rfqId, { currency, totalAmount, notes, autoSubmitForApproval });

    let fileMessage = "";
    if (quoteFiles.length > 0) {
      try {
        for (const file of quoteFiles) {
          await uploadFilePresigned(rfqId, file, created.id);
        }
        fileMessage = " Quote files have been uploaded.";
      } catch {
        fileMessage = " However, quote file upload failed.";
      }
    }

    revalidateRfq(rfqId);
    return { status: "success", message: `Quote revision has been created.${fileMessage}` };
  } catch (error) {
    handleAuthRedirect(error);
    await handleRfqNotFound(error);

    if (isApiClientError(error)) {
      if (error.code === "INVALID_REQUEST") return { status: "error", message: "Quote revision input is invalid." };
      if (error.code === "FORBIDDEN") return { status: "error", message: "You are not allowed to create quote revisions for this RFQ." };
      if (error.code === "NETWORK_ERROR") return { status: "error", message: "API is unreachable. Please check backend status." };
    }

    return { status: "error", message: "Quote revision could not be created." };
  }
}

/* ── Decide Approval ──────────────────────────────────── */

export async function decideApprovalAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const rfqId = String(formData.get("rfqId") ?? "").trim();
  const quoteRevisionId = String(formData.get("quoteRevisionId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim() as "APPROVED" | "REJECTED";
  const comment = String(formData.get("comment") ?? "").trim();

  if (!rfqId || !quoteRevisionId || !decision || !comment) {
    return { status: "error", message: "All fields are required." };
  }

  try {
    await decideQuoteApproval(rfqId, { quoteRevisionId, decision, comment });
    revalidateRfq(rfqId);
    return { status: "success", message: `Manager decision saved: ${decision}.` };
  } catch (error) {
    handleAuthRedirect(error);

    if (isApiClientError(error)) {
      if (error.code === "INVALID_REQUEST") return { status: "error", message: "Approval input is invalid." };
      if (error.code === "FORBIDDEN") return { status: "error", message: "Only Istanbul manager can approve quotes." };
      if (error.code === "QUOTE_REVISION_NOT_FOUND" || error.code === "RFQ_NOT_FOUND") return { status: "error", message: "Selected RFQ or quote revision was not found." };
      if (error.code === "NETWORK_ERROR") return { status: "error", message: "API is unreachable. Please check backend status." };
    }

    return { status: "error", message: "Manager decision failed." };
  }
}
