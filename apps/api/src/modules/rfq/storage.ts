import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiError } from "../../errors.js";
import { config } from "../../config.js";

const { endpoint, port, useSsl, accessKey, secretKey, region, bucket } = config.storage;
const isAwsS3 = endpoint.includes("amazonaws.com");

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
  },
  ...(isAwsS3
    ? {}
    : {
        endpoint: `${useSsl ? "https" : "http"}://${endpoint}:${port}`,
        forcePathStyle: true,
      }),
});

let ensureBucketTask: Promise<void> | null = null;

async function ensureBucket() {
  if (ensureBucketTask) return ensureBucketTask;

  ensureBucketTask = (async () => {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (err: unknown) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) {
        await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      } else {
        throw new ApiError("STORAGE_ERROR", "Storage bucket check failed.", 500);
      }
    }
  })();

  try {
    await ensureBucketTask;
  } catch (error) {
    ensureBucketTask = null;
    throw error;
  }
}

function safeFileName(fileName: string): string {
  const normalized = fileName.trim().replaceAll("\\", "/").split("/").at(-1) ?? "file";
  const cleaned = normalized.replaceAll(/[^A-Za-z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned.slice(0, 160) : "file";
}

function storageKeyFor(input: { rfqId: string; quoteRevisionId?: string; originalFileName: string }): string {
  const prefix = input.quoteRevisionId
    ? `rfq/${input.rfqId}/quote-revisions/${input.quoteRevisionId}`
    : `rfq/${input.rfqId}/requests`;
  const fileName = safeFileName(input.originalFileName);
  const stamp = Date.now();
  return `${prefix}/${stamp}-${randomUUID()}-${fileName}`;
}

/** Generate a presigned PUT URL for direct client-to-S3 upload */
export async function getPresignedUploadUrl(input: {
  rfqId: string;
  quoteRevisionId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  await ensureBucket();

  const storageKey = storageKeyFor({
    rfqId: input.rfqId,
    quoteRevisionId: input.quoteRevisionId,
    originalFileName: input.fileName,
  });

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: input.mimeType || "application/octet-stream",
    ContentLength: input.sizeBytes,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes

  return { url, storageKey };
}

/** Generate a presigned GET URL for direct client-from-S3 download */
export async function getPresignedDownloadUrl(storageKey: string, fileName: string) {
  await ensureBucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ResponseContentDisposition: `inline; filename="${safeFileName(fileName)}"`,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 minutes

  return { url };
}

/** Legacy: upload via API (kept for backward compatibility with base64 uploads) */
export async function uploadAttachmentToStorage(input: {
  rfqId: string;
  quoteRevisionId?: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}) {
  await ensureBucket();

  const storageKey = storageKeyFor({
    rfqId: input.rfqId,
    quoteRevisionId: input.quoteRevisionId,
    originalFileName: input.fileName,
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: input.bytes,
      ContentType: input.mimeType || "application/octet-stream",
    }),
  );

  return { storageKey, sizeBytes: input.bytes.byteLength };
}

/** Legacy: download via API proxy (kept for backward compatibility) */
export async function downloadAttachmentFromStorage(storageKey: string) {
  await ensureBucket();

  const result = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    }),
  );

  if (!result.Body) {
    throw new ApiError("ATTACHMENT_NOT_FOUND", "Attachment could not be found in storage.", 404);
  }

  const data = Buffer.from(await result.Body.transformToByteArray());
  const contentType = result.ContentType ?? "application/octet-stream";

  return { data, contentType };
}
