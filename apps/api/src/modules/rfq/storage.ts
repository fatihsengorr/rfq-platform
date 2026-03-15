import { createHash, createHmac, randomUUID } from "node:crypto";
import { ApiError } from "../../errors.js";

const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT ?? "localhost";
const STORAGE_PORT = Number(process.env.STORAGE_PORT ?? "9000");
const STORAGE_USE_SSL = String(process.env.STORAGE_USE_SSL ?? "false").toLowerCase() === "true";
const STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY ?? "minio";
const STORAGE_SECRET_KEY = process.env.STORAGE_SECRET_KEY ?? "minio123";
const STORAGE_REGION = process.env.STORAGE_REGION ?? "us-east-1";
const STORAGE_BUCKET = process.env.STORAGE_BUCKET ?? "rfq-attachments";

const EMPTY_BODY = Buffer.alloc(0);
const EMPTY_BODY_HASH = createHash("sha256").update(EMPTY_BODY).digest("hex");

let ensureBucketTask: Promise<void> | null = null;

function protocol() {
  return STORAGE_USE_SSL ? "https" : "http";
}

function hostHeader() {
  const defaultPort = STORAGE_USE_SSL ? 443 : 80;
  if (STORAGE_PORT === defaultPort) {
    return STORAGE_ENDPOINT;
  }

  return `${STORAGE_ENDPOINT}:${STORAGE_PORT}`;
}

function baseUrl() {
  return `${protocol()}://${hostHeader()}`;
}

function sha256Hex(payload: Buffer): string {
  return createHash("sha256").update(payload).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function signingKey(dateStamp: string): Buffer {
  const dateKey = hmac(`AWS4${STORAGE_SECRET_KEY}`, dateStamp);
  const regionKey = hmac(dateKey, STORAGE_REGION);
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

function toAmzDate(date: Date): string {
  const iso = date.toISOString();
  return iso.replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

function toDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}

function safeFileName(fileName: string): string {
  const normalized = fileName.trim().replaceAll("\\", "/").split("/").at(-1) ?? "file";
  const cleaned = normalized.replaceAll(/[^A-Za-z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned.slice(0, 160) : "file";
}

function buildCanonicalRequest(input: {
  method: string;
  canonicalUri: string;
  payloadHash: string;
  amzDate: string;
  contentType?: string;
}) {
  const headerEntries: Array<[string, string]> = [["host", hostHeader()], ["x-amz-content-sha256", input.payloadHash], ["x-amz-date", input.amzDate]];

  if (input.contentType) {
    headerEntries.push(["content-type", input.contentType]);
  }

  headerEntries.sort(([a], [b]) => a.localeCompare(b));

  const canonicalHeaders = headerEntries.map(([key, value]) => `${key}:${value.trim()}\n`).join("");
  const signedHeaders = headerEntries.map(([key]) => key).join(";");

  const canonicalRequest = [
    input.method,
    input.canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    input.payloadHash
  ].join("\n");

  return { canonicalRequest, signedHeaders };
}

async function signedStorageRequest(input: {
  method: "GET" | "HEAD" | "PUT";
  bucketPath: string;
  payload?: Buffer;
  contentType?: string;
}) {
  const payload = input.payload ?? EMPTY_BODY;
  const payloadHash = payload.length === 0 ? EMPTY_BODY_HASH : sha256Hex(payload);
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(now);
  const canonicalUri = `/${encodePath(trimSlashes(input.bucketPath))}`;
  const scope = `${dateStamp}/${STORAGE_REGION}/s3/aws4_request`;

  const { canonicalRequest, signedHeaders } = buildCanonicalRequest({
    method: input.method,
    canonicalUri,
    payloadHash,
    amzDate,
    contentType: input.contentType
  });

  const canonicalRequestHash = createHash("sha256").update(canonicalRequest).digest("hex");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, canonicalRequestHash].join("\n");
  const signature = createHmac("sha256", signingKey(dateStamp)).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${STORAGE_ACCESS_KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const url = `${baseUrl()}${canonicalUri}`;

  const headers: Record<string, string> = {
    host: hostHeader(),
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    Authorization: authorization
  };

  if (input.contentType) {
    headers["content-type"] = input.contentType;
  }

  return fetch(url, {
    method: input.method,
    headers,
    body: input.method === "GET" || input.method === "HEAD" ? undefined : new Uint8Array(payload)
  });
}

async function ensureBucket() {
  if (ensureBucketTask) {
    return ensureBucketTask;
  }

  ensureBucketTask = (async () => {
    const head = await signedStorageRequest({
      method: "HEAD",
      bucketPath: STORAGE_BUCKET
    });

    if (head.ok) {
      return;
    }

    if (head.status !== 404) {
      throw new ApiError("STORAGE_ERROR", "Storage bucket check failed.", 500);
    }

    const create = await signedStorageRequest({
      method: "PUT",
      bucketPath: STORAGE_BUCKET
    });

    if (!create.ok) {
      throw new ApiError("STORAGE_ERROR", "Storage bucket creation failed.", 500);
    }
  })();

  try {
    await ensureBucketTask;
  } catch (error) {
    ensureBucketTask = null;
    throw error;
  }
}

function storageKeyFor(input: { rfqId: string; quoteRevisionId?: string; originalFileName: string }): string {
  const prefix = input.quoteRevisionId
    ? `rfq/${input.rfqId}/quote-revisions/${input.quoteRevisionId}`
    : `rfq/${input.rfqId}/requests`;
  const fileName = safeFileName(input.originalFileName);
  const stamp = Date.now();
  return `${prefix}/${stamp}-${randomUUID()}-${fileName}`;
}

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
    originalFileName: input.fileName
  });

  const upload = await signedStorageRequest({
    method: "PUT",
    bucketPath: `${STORAGE_BUCKET}/${storageKey}`,
    payload: input.bytes,
    contentType: input.mimeType || "application/octet-stream"
  });

  if (!upload.ok) {
    throw new ApiError("STORAGE_ERROR", "Storage upload failed.", 500);
  }

  return {
    storageKey,
    sizeBytes: input.bytes.byteLength
  };
}

export async function downloadAttachmentFromStorage(storageKey: string) {
  await ensureBucket();

  const result = await signedStorageRequest({
    method: "GET",
    bucketPath: `${STORAGE_BUCKET}/${storageKey}`
  });

  if (result.status === 404) {
    throw new ApiError("ATTACHMENT_NOT_FOUND", "Attachment could not be found in storage.", 404);
  }

  if (!result.ok) {
    throw new ApiError("STORAGE_ERROR", "Storage download failed.", 500);
  }

  const data = Buffer.from(await result.arrayBuffer());
  const contentType = result.headers.get("content-type") ?? "application/octet-stream";

  return {
    data,
    contentType
  };
}
