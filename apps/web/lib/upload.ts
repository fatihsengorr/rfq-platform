import { getPresignedUploadUrl, confirmUpload } from "../app/api";
import type { Attachment } from "@crm/shared";

/**
 * Upload a file to S3 via presigned URL, then confirm with the API.
 * Centralizes the 3-step presigned upload flow used across the app.
 */
export async function uploadFilePresigned(
  rfqId: string,
  file: File,
  quoteRevisionId?: string
): Promise<Attachment> {
  const fileName = file.name?.trim() || "attachment.bin";
  const mimeType = file.type || "application/octet-stream";

  // 1. Get presigned URL from API
  const { uploadUrl, storageKey } = await getPresignedUploadUrl(rfqId, {
    fileName,
    mimeType,
    sizeBytes: file.size,
    quoteRevisionId,
  });

  // 2. Upload directly to S3/MinIO
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: Buffer.from(await file.arrayBuffer()),
  });

  if (!uploadResponse.ok) {
    throw new Error(`S3 upload failed: ${uploadResponse.status}`);
  }

  // 3. Confirm upload with API (creates DB record)
  return confirmUpload(rfqId, {
    storageKey,
    fileName,
    mimeType,
    sizeBytes: file.size,
    quoteRevisionId,
  });
}
