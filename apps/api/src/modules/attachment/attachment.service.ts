import { ApiError } from "../../errors.js";
import { prisma } from "../../prisma.js";
import { config } from "../../config.js";
import {
  getPresignedUploadUrlForEntity,
  downloadAttachmentFromStorage,
  deleteObjectFromStorage,
} from "../rfq/storage.js";

const API_PUBLIC_BASE_URL = config.publicApiBaseUrl;
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

// Files attached to projects (tender drawings, site photos) and companies
// (contracts, profiles). Engineering + image + common office formats.
const SUPPORTED_EXTENSIONS = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
  ".dwg", ".dxf", ".step", ".stp", ".igs", ".iges",
  ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".zip",
]);

function fileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot < 0 ? "" : fileName.slice(lastDot).toLowerCase();
}

export function isAllowedCrmFile(fileName: string, mimeType: string): boolean {
  if (SUPPORTED_EXTENSIONS.has(fileExtension(fileName))) return true;
  const m = mimeType.toLowerCase();
  return m === "application/pdf" || m.startsWith("image/");
}

export type AttachmentScope = "project" | "company";

function attachmentDownloadUrl(id: string): string {
  return `${API_PUBLIC_BASE_URL}/api/attachments/${id}/download`;
}

async function assertEntityExists(scope: AttachmentScope, entityId: string): Promise<void> {
  if (scope === "project") {
    const p = await prisma.project.findUnique({ where: { id: entityId }, select: { id: true } });
    if (!p) throw new ApiError("PROJECT_NOT_FOUND", "Project was not found.", 404);
  } else {
    const c = await prisma.customerCompany.findUnique({ where: { id: entityId }, select: { id: true } });
    if (!c) throw new ApiError("RFQ_NOT_FOUND", "Company not found.", 404);
  }
}

// ── Presign (direct client → S3) ───────────────────────────────────
export async function presignEntityUpload(input: {
  scope: AttachmentScope;
  entityId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  if (!isAllowedCrmFile(input.fileName, input.mimeType)) {
    throw new ApiError("ATTACHMENT_UNSUPPORTED", "This file type is not supported.", 400);
  }
  if (input.sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new ApiError("ATTACHMENT_TOO_LARGE", `File exceeds ${MAX_ATTACHMENT_BYTES} bytes limit.`, 400);
  }
  await assertEntityExists(input.scope, input.entityId);

  const { url, storageKey } = await getPresignedUploadUrlForEntity(input);
  return { uploadUrl: url, storageKey };
}

// ── Confirm (record the row after the PUT succeeds) ────────────────
export async function confirmEntityUpload(input: {
  scope: AttachmentScope;
  entityId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedById: string;
}) {
  await assertEntityExists(input.scope, input.entityId);

  const attachment = await prisma.attachment.create({
    data: {
      category: input.scope === "project" ? "PROJECT_FILE" : "COMPANY_FILE",
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageKey: input.storageKey,
      publicUrl: "",
      projectId: input.scope === "project" ? input.entityId : null,
      companyId: input.scope === "company" ? input.entityId : null,
      uploadedById: input.uploadedById,
    },
    include: { uploadedBy: { select: { fullName: true } } },
  });

  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    url: attachmentDownloadUrl(attachment.id),
    uploadedAt: attachment.createdAt.toISOString(),
    uploadedBy: attachment.uploadedBy.fullName,
  };
}

// ── Download (API proxy; access already gated to sales/admin by route) ──
export async function getCrmAttachmentForDownload(id: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: { id: true, fileName: true, mimeType: true, storageKey: true, projectId: true, companyId: true },
  });
  // Only project/company-scoped files are served here; RFQ files use their own route.
  if (!attachment || (!attachment.projectId && !attachment.companyId)) {
    throw new ApiError("ATTACHMENT_NOT_FOUND", "Attachment was not found.", 404);
  }
  const downloaded = await downloadAttachmentFromStorage(attachment.storageKey);
  return { ...attachment, data: downloaded.data, contentType: downloaded.contentType };
}

// ── Remove (DB row + storage object) ───────────────────────────────
export async function removeCrmAttachment(id: string): Promise<void> {
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: { id: true, storageKey: true, projectId: true, companyId: true },
  });
  if (!attachment || (!attachment.projectId && !attachment.companyId)) {
    throw new ApiError("ATTACHMENT_NOT_FOUND", "Attachment was not found.", 404);
  }
  await prisma.attachment.delete({ where: { id } });
  try {
    await deleteObjectFromStorage(attachment.storageKey);
  } catch {
    // Storage object orphaned but DB row is gone; acceptable, low cost.
  }
}
