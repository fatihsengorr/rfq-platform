"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assignRfqToPricingUser,
  createQuoteRevision,
  decideQuoteApproval,
  isApiClientError,
  reviseRfqRequest,
  setRfqStatus,
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
  const changeReason = String(formData.get("changeReason") ?? "").trim();

  if (!rfqId || !projectName || !requestedBy || !deadlineRaw || !projectDetails) {
    return { status: "error", message: "All fields are required." };
  }

  // Faz 3 — Feature 2: changeReason is mandatory for every revision.
  if (changeReason.length < 10) {
    return {
      status: "error",
      message: "Please describe why you're revising this RFQ (at least 10 characters).",
      fieldErrors: { changeReason: "Reason is required (min 10 chars)" },
    };
  }

  try {
    const deadline = new Date(deadlineRaw).toISOString();
    await reviseRfqRequest(rfqId, { projectName, requestedBy, deadline, projectDetails, changeReason });
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
  // Faz 3 — Feature 2: optional on v1, required on v2+ (API enforces)
  const changeReasonRaw = String(formData.get("changeReason") ?? "").trim();
  const rfqRevisionIdRaw = String(formData.get("rfqRevisionId") ?? "").trim();
  const isRevision = formData.get("isRevision") === "true";

  if (!rfqId || !currency || !totalAmountRaw || !notes) {
    return { status: "error", message: "All fields are required." };
  }

  // Client-side enforcement when we know this is a v2+ revision.
  if (isRevision && changeReasonRaw.length < 10) {
    return {
      status: "error",
      message: "Please describe why you're creating this quote revision (at least 10 characters).",
      fieldErrors: { changeReason: "Reason is required (min 10 chars)" },
    };
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
    const created = await createQuoteRevision(rfqId, {
      currency,
      totalAmount,
      notes,
      autoSubmitForApproval,
      ...(changeReasonRaw ? { changeReason: changeReasonRaw } : {}),
      ...(rfqRevisionIdRaw ? { rfqRevisionId: rfqRevisionIdRaw } : {}),
    });

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

/* ── Mark Outcome (WON / LOST) ─────────────────────────── */

export async function markRfqWonAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const rfqId = String(formData.get("rfqId") ?? "").trim();

  if (!rfqId) return { status: "error", message: "RFQ id is required." };

  try {
    await setRfqStatus(rfqId, { status: "WON" });
    revalidateRfq(rfqId);
    return { status: "success", message: "RFQ marked as Won." };
  } catch (error) {
    handleAuthRedirect(error);
    await handleRfqNotFound(error);

    if (isApiClientError(error)) {
      if (error.code === "FORBIDDEN") return { status: "error", message: "You don't have permission to mark this RFQ as Won." };
      if (error.code === "NETWORK_ERROR") return { status: "error", message: "API is unreachable. Please check backend status." };
    }

    return { status: "error", message: "Marking RFQ as Won failed." };
  }
}

export async function markRfqLostAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const rfqId = String(formData.get("rfqId") ?? "").trim();
  const lostReason = String(formData.get("lostReason") ?? "").trim();

  if (!rfqId) return { status: "error", message: "RFQ id is required." };
  if (lostReason.length < 3) {
    return {
      status: "error",
      message: "A reason is required when marking as Lost (min 3 characters).",
      fieldErrors: { lostReason: "Reason required" },
    };
  }

  try {
    await setRfqStatus(rfqId, { status: "LOST", lostReason });
    revalidateRfq(rfqId);
    return { status: "success", message: "RFQ marked as Lost." };
  } catch (error) {
    handleAuthRedirect(error);
    await handleRfqNotFound(error);

    if (isApiClientError(error)) {
      if (error.code === "FORBIDDEN") return { status: "error", message: "You don't have permission to mark this RFQ as Lost." };
      if (error.code === "INVALID_REQUEST") return { status: "error", message: "Lost reason is invalid or missing." };
      if (error.code === "NETWORK_ERROR") return { status: "error", message: "API is unreachable. Please check backend status." };
    }

    return { status: "error", message: "Marking RFQ as Lost failed." };
  }
}

export async function reopenRfqAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const rfqId = String(formData.get("rfqId") ?? "").trim();
  const targetStatus = String(formData.get("status") ?? "QUOTED").trim();

  if (!rfqId) return { status: "error", message: "RFQ id is required." };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await setRfqStatus(rfqId, { status: targetStatus as any });
    revalidateRfq(rfqId);
    return { status: "success", message: "RFQ re-opened." };
  } catch (error) {
    handleAuthRedirect(error);
    await handleRfqNotFound(error);

    if (isApiClientError(error)) {
      if (error.code === "FORBIDDEN") return { status: "error", message: "You don't have permission to re-open this RFQ." };
      if (error.code === "NETWORK_ERROR") return { status: "error", message: "API is unreachable. Please check backend status." };
    }

    return { status: "error", message: "Re-opening RFQ failed." };
  }
}
