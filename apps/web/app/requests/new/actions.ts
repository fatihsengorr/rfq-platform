"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRfq, isApiClientError } from "../../api";
import { getSession } from "../../../lib/session";
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

export async function createRfqAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const projectName = String(formData.get("projectName") ?? "").trim();
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();
  const projectDetails = String(formData.get("projectDetails") ?? "").trim();
  const requestFiles = parseFiles(formData, "requestFiles");

  const session = await getSession();
  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  const canCreateRfq = session.user.role === "LONDON_SALES" || session.user.role === "ADMIN";
  if (!canCreateRfq) {
    return { status: "error", message: "You do not have permission to create an RFQ." };
  }

  // Company & contact from form (set by CompanyCombobox hidden inputs)
  const companyId = (formData.get("companyId") as string)?.trim() || undefined;
  const contactId = (formData.get("contactId") as string)?.trim() || undefined;
  const requestedBy = (formData.get("requestedBy") as string)?.trim() || session.user.fullName.trim();

  if (!projectName || !requestedBy || !deadlineRaw || !projectDetails) {
    return { status: "error", message: "All fields are required." };
  }

  if (requestFiles.length > MAX_ATTACHMENT_FILES) {
    return { status: "error", message: "You can upload up to 10 files at once." };
  }

  if (hasOversizedFile(requestFiles)) {
    return { status: "error", message: "Attachment is too large. Max size is 50 MB per file." };
  }

  try {
    const deadline = new Date(deadlineRaw).toISOString();
    const created = await createRfq({
      projectName,
      requestedBy,
      deadline,
      projectDetails,
      companyId,
      contactId,
    });

    let fileMessage = "";

    if (requestFiles.length > 0) {
      try {
        for (const file of requestFiles) {
          await uploadFilePresigned(created.id, file);
        }
        fileMessage = " Files uploaded successfully.";
      } catch (error) {
        if (isApiClientError(error) && error.code === "UNAUTHORIZED") {
          redirect("/login");
        }
        fileMessage = " However, file upload failed.";
      }
    }

    revalidatePath("/");
    revalidatePath("/requests");
    revalidatePath(`/requests/${created.id}`);

    return {
      status: "success",
      message: `RFQ created successfully.${fileMessage}`,
      redirectTo: `/requests/${created.id}`,
    };
  } catch (error) {
    if (isApiClientError(error)) {
      if (error.code === "UNAUTHORIZED") redirect("/login");
      if (error.code === "INVALID_REQUEST") return { status: "error", message: "Request validation failed. Please review the required fields." };
      if (error.code === "FORBIDDEN") return { status: "error", message: "You do not have permission to create an RFQ." };
      if (error.code === "NETWORK_ERROR") return { status: "error", message: "API is unreachable. Please check if backend is running." };
    }

    return { status: "error", message: "RFQ could not be created. Please try again." };
  }
}
