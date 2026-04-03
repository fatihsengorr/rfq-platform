import type { FastifyPluginAsync } from "fastify";
import { UserRole as DbUserRole } from "@prisma/client";
import { z } from "zod";
import { ApiError, isApiError } from "../../errors.js";
import { extractBearerToken, resolveAccessToken } from "../auth/auth.service.js";
import { rfqStore } from "./rfq.store.js";
import { downloadAttachmentFromStorage, uploadAttachmentToStorage, getPresignedUploadUrl, getPresignedDownloadUrl } from "./storage.js";
import { type UserRole as RfqRole } from "./rfq.types.js";
import { sendNotification } from "../email/email.service.js";
import {
  newRfqNotification,
  assignmentNotification,
  quoteSubmittedNotification,
  approvalDecisionNotification,
} from "../email/email.templates.js";

const createRfqSchema = z.object({
  projectName: z.string().min(2),
  deadline: z.string().datetime(),
  projectDetails: z.string().min(10),
  requestedBy: z.string().min(2)
});

const createRevisionSchema = z.object({
  currency: z.enum(["GBP", "EUR", "USD", "TRY"]),
  totalAmount: z.number().positive(),
  notes: z.string().min(2),
  autoSubmitForApproval: z.boolean().default(true)
});

const approvalSchema = z.object({
  quoteRevisionId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().min(2)
});

const assignSchema = z.object({
  assignedPricingUserId: z.string().uuid()
});

const statusSchema = z.object({
  status: z.enum([
    "NEW",
    "IN_REVIEW",
    "PRICING_IN_PROGRESS",
    "PENDING_MANAGER_APPROVAL",
    "QUOTED",
    "REVISION_REQUESTED",
    "CLOSED"
  ])
});

const createAttachmentSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  base64Data: z.string().min(1),
  quoteRevisionId: z.string().uuid().optional()
});

const presignUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
  quoteRevisionId: z.string().uuid().optional()
});

const confirmUploadSchema = z.object({
  storageKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  quoteRevisionId: z.string().uuid().optional()
});

const supportedAttachmentExtensions = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".dwg",
  ".dxf",
  ".step",
  ".stp",
  ".igs",
  ".iges"
]);

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

function sendError(reply: { status: (code: number) => { send: (body: unknown) => unknown } }, error: unknown) {
  if (isApiError(error)) {
    return reply.status(error.status).send({ code: error.code, message: error.message });
  }

  return reply.status(500).send({ code: "INTERNAL_ERROR", message: "An unexpected server error occurred." });
}

async function requireAuthSession(
  request: { headers: { authorization?: string | string[] } },
  reply: { status: (code: number) => { send: (body: unknown) => unknown } }
) {
  const token = extractBearerToken(request.headers.authorization);

  if (!token) {
    sendError(reply, new ApiError("UNAUTHORIZED", "Authentication token is required.", 401));
    return null;
  }

  try {
    return await resolveAccessToken(token);
  } catch (error) {
    sendError(reply, error);
    return null;
  }
}

function mapDbRoleToRfqRole(role: DbUserRole): RfqRole {
  if (role === DbUserRole.LONDON_SALES) return "LONDON_SALES";
  if (role === DbUserRole.ISTANBUL_PRICING) return "ISTANBUL_PRICING";
  if (role === DbUserRole.ISTANBUL_MANAGER) return "ISTANBUL_MANAGER";
  return "ADMIN";
}

function resolveFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");

  if (lastDot < 0) {
    return "";
  }

  return fileName.slice(lastDot).toLowerCase();
}

function isAllowedAttachment(fileName: string, mimeType: string): boolean {
  const extension = resolveFileExtension(fileName);
  const normalizedMime = mimeType.toLowerCase();

  if (supportedAttachmentExtensions.has(extension)) {
    return true;
  }

  return normalizedMime === "application/pdf" || normalizedMime.startsWith("image/");
}

function toSafeDownloadName(fileName: string): string {
  const normalized = fileName.trim().replaceAll("\\", "/").split("/").at(-1) ?? "attachment";
  const safe = normalized.replaceAll(/[^A-Za-z0-9._-]/g, "_");
  return safe.length > 0 ? safe : "attachment";
}

export const registerRfqRoutes: FastifyPluginAsync = async (server) => {
  server.get("/", async (request, reply) => {
    const session = await requireAuthSession(request, reply);

    if (!session) {
      return;
    }

    const role = mapDbRoleToRfqRole(session.user.role);
    return await rfqStore.list(role, session.user.id);
  });

  server.get("/pricing-users", async (request, reply) => {
    const session = await requireAuthSession(request, reply);

    if (!session) {
      return;
    }

    const role = mapDbRoleToRfqRole(session.user.role);

    if (!(role === "ISTANBUL_MANAGER" || role === "ADMIN")) {
      return reply.status(403).send({
        code: "FORBIDDEN",
        message: "Only Istanbul manager can list pricing users."
      });
    }

    return await rfqStore.listPricingUsers();
  });

  server.get("/:id", async (request, reply) => {
    const session = await requireAuthSession(request, reply);

    if (!session) {
      return;
    }

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const role = mapDbRoleToRfqRole(session.user.role);
    const record = await rfqStore.getById(params.data.id, role, session.user.id);

    if (!record) {
      return reply.status(404).send({ code: "RFQ_NOT_FOUND", message: "RFQ record was not found." });
    }

    return record;
  });

  server.post("/", async (request, reply) => {
    const session = await requireAuthSession(request, reply);

    if (!session) {
      return;
    }

    const role = mapDbRoleToRfqRole(session.user.role);

    if (!rfqStore.canPerform(role, "CREATE_RFQ")) {
      return reply.status(403).send({
        code: "FORBIDDEN",
        message: "Only London users can create RFQ records."
      });
    }

    const parsed = createRfqSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    const payload = parsed.data;
    const created = await rfqStore.create({
      projectName: payload.projectName,
      deadline: payload.deadline,
      projectDetails: payload.projectDetails,
      requestedBy: payload.requestedBy,
      createdById: session.user.id
    });

    // Email: notify Istanbul managers about new RFQ
    const managers = await rfqStore.getManagerUsers();
    const webBase = process.env.APP_WEB_BASE_URL ?? "http://localhost:3000";
    const rfqUrl = `${webBase}/requests/${created.id}`;
    for (const mgr of managers) {
      const tpl = newRfqNotification(payload.projectName, payload.requestedBy, payload.deadline, session.user.fullName, rfqUrl);
      sendNotification({ type: "NEW_RFQ", recipientId: mgr.id, recipientEmail: mgr.email, rfqId: created.id, ...tpl });
    }

    return reply.status(201).send(created);
  });

  server.patch("/:id/request", async (request, reply) => {
    const session = await requireAuthSession(request, reply);

    if (!session) {
      return;
    }

    const role = mapDbRoleToRfqRole(session.user.role);

    if (!rfqStore.canPerform(role, "UPDATE_RFQ_REQUEST")) {
      return reply.status(403).send({
        code: "FORBIDDEN",
        message: "Only London users can revise RFQ request details."
      });
    }

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = createRfqSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    try {
      const updated = await rfqStore.reviseRequest(params.data.id, parsed.data);
      return reply.status(200).send(updated);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post("/:id/assignment", async (request, reply) => {
    const session = await requireAuthSession(request, reply);

    if (!session) {
      return;
    }

    const role = mapDbRoleToRfqRole(session.user.role);

    if (!rfqStore.canPerform(role, "ASSIGN_RFQ")) {
      return reply.status(403).send({
        code: "FORBIDDEN",
        message: "Only Istanbul manager can assign RFQs."
      });
    }

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = assignSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    try {
      const updated = await rfqStore.assignPricingUser(params.data.id, {
        assignedPricingUserId: parsed.data.assignedPricingUserId,
        assignedById: session.user.id
      });

      // Email: notify assigned pricing user
      const assignee = await rfqStore.getUserEmail(parsed.data.assignedPricingUserId);
      if (assignee) {
        const webBase = process.env.APP_WEB_BASE_URL ?? "http://localhost:3000";
        const tpl = assignmentNotification(updated.projectName, session.user.fullName, `${webBase}/requests/${params.data.id}`);
        sendNotification({ type: "ASSIGNMENT", recipientId: assignee.id, recipientEmail: assignee.email, rfqId: params.data.id, ...tpl });
      }

      return reply.status(200).send(updated);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post("/:id/quotes", async (request, reply) => {
    const session = await requireAuthSession(request, reply);

    if (!session) {
      return;
    }

    const role = mapDbRoleToRfqRole(session.user.role);

    if (!rfqStore.canPerform(role, "CREATE_QUOTE")) {
      return reply.status(403).send({
        code: "FORBIDDEN",
        message: "Only Istanbul pricing users can create quote revisions."
      });
    }

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = createRevisionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    try {
      const created = await rfqStore.addQuoteRevision(params.data.id, {
        ...parsed.data,
        createdById: session.user.id,
        createdByRole: role
      });

      // Email: notify managers when quote is submitted for approval
      if (parsed.data.autoSubmitForApproval) {
        const managers = await rfqStore.getManagerUsers();
        const rfqDetail = await rfqStore.getById(params.data.id, "ADMIN", "");
        const webBase = process.env.APP_WEB_BASE_URL ?? "http://localhost:3000";
        const rfqUrl = `${webBase}/requests/${params.data.id}`;
        const projectName = rfqDetail?.projectName ?? "RFQ";
        for (const mgr of managers) {
          const tpl = quoteSubmittedNotification(projectName, created.versionNumber, session.user.fullName, rfqUrl);
          sendNotification({ type: "QUOTE_SUBMITTED", recipientId: mgr.id, recipientEmail: mgr.email, rfqId: params.data.id, ...tpl });
        }
      }

      return reply.status(201).send(created);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post("/:id/approval", async (request, reply) => {
    const session = await requireAuthSession(request, reply);

    if (!session) {
      return;
    }

    const role = mapDbRoleToRfqRole(session.user.role);

    if (!rfqStore.canPerform(role, "APPROVE_QUOTE")) {
      return reply.status(403).send({
        code: "FORBIDDEN",
        message: "Only Istanbul manager can approve or reject quotes."
      });
    }

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = approvalSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    try {
      const decision = await rfqStore.decideApproval(params.data.id, {
        ...parsed.data,
        decidedById: session.user.id
      });

      // Email: notify pricing user + RFQ creator about the decision
      const rfqDetail = await rfqStore.getById(params.data.id, "ADMIN", "");
      if (rfqDetail) {
        const webBase = process.env.APP_WEB_BASE_URL ?? "http://localhost:3000";
        const rfqUrl = `${webBase}/requests/${params.data.id}`;
        const latestRevision = [...rfqDetail.quoteRevisions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
        const versionNumber = latestRevision?.versionNumber ?? 1;

        const recipientIds = new Set<string>();

        // Notify assigned pricing user
        if (rfqDetail.assignedPricingUserId) {
          recipientIds.add(rfqDetail.assignedPricingUserId);
        }

        // Notify RFQ creator
        const creatorId = await rfqStore.getRfqCreatorId(params.data.id);
        if (creatorId) {
          recipientIds.add(creatorId);
        }

        for (const recipientId of recipientIds) {
          const user = await rfqStore.getUserEmail(recipientId);
          if (user) {
            const tpl = approvalDecisionNotification(rfqDetail.projectName, versionNumber, parsed.data.decision, parsed.data.comment, session.user.fullName, rfqUrl);
            sendNotification({ type: "APPROVAL_DECISION", recipientId: user.id, recipientEmail: user.email, rfqId: params.data.id, ...tpl });
          }
        }
      }

      return reply.status(200).send(decision);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.patch("/:id/status", async (request, reply) => {
    const session = await requireAuthSession(request, reply);

    if (!session) {
      return;
    }

    const role = mapDbRoleToRfqRole(session.user.role);

    if (!(role === "ISTANBUL_MANAGER" || role === "ADMIN")) {
      return reply.status(403).send({
        code: "FORBIDDEN",
        message: "Only Istanbul manager can directly update RFQ status."
      });
    }

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = statusSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    try {
      const updated = await rfqStore.setStatus(params.data.id, parsed.data.status);
      return reply.status(200).send(updated);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post("/:id/attachments", async (request, reply) => {
    const session = await requireAuthSession(request, reply);

    if (!session) {
      return;
    }

    const role = mapDbRoleToRfqRole(session.user.role);
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = createAttachmentSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    const payload = parsed.data;
    const mimeType = payload.mimeType || "application/octet-stream";

    if (!isAllowedAttachment(payload.fileName, mimeType)) {
      return reply.status(415).send({
        code: "ATTACHMENT_UNSUPPORTED",
        message: "Unsupported file type. Allowed: PDF, image formats, and CAD drawing files."
      });
    }

    let bytes: Buffer;

    try {
      bytes = Buffer.from(payload.base64Data, "base64");
    } catch {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Attachment payload is not valid base64 data."
      });
    }

    if (bytes.length === 0) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Attachment payload is empty."
      });
    }

    if (bytes.length > MAX_ATTACHMENT_BYTES) {
      return reply.status(413).send({
        code: "ATTACHMENT_TOO_LARGE",
        message: `Attachment exceeds ${MAX_ATTACHMENT_BYTES} bytes limit.`
      });
    }

    try {
      const storage = await uploadAttachmentToStorage({
        rfqId: params.data.id,
        quoteRevisionId: payload.quoteRevisionId,
        fileName: payload.fileName,
        mimeType,
        bytes
      });

      const attachment = await rfqStore.addAttachment({
        rfqId: params.data.id,
        quoteRevisionId: payload.quoteRevisionId,
        fileName: payload.fileName,
        mimeType,
        sizeBytes: storage.sizeBytes,
        storageKey: storage.storageKey,
        uploadedById: session.user.id,
        uploadedByRole: role
      });

      return reply.status(201).send(attachment);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.get("/attachments/:attachmentId/download", async (request, reply) => {
    const session = await requireAuthSession(request, reply);

    if (!session) {
      return;
    }

    const params = z.object({ attachmentId: z.string().uuid() }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Route parameter 'attachmentId' must be a valid UUID."
      });
    }

    const role = mapDbRoleToRfqRole(session.user.role);
    const attachment = await rfqStore.getAttachmentForDownload(params.data.attachmentId, role, session.user.id);

    if (!attachment) {
      return reply.status(404).send({
        code: "ATTACHMENT_NOT_FOUND",
        message: "Attachment was not found."
      });
    }

    try {
      const downloaded = await downloadAttachmentFromStorage(attachment.storageKey);
      reply.header("Content-Type", downloaded.contentType || attachment.mimeType || "application/octet-stream");
      reply.header("Content-Disposition", `inline; filename="${toSafeDownloadName(attachment.fileName)}"`);
      return reply.send(downloaded.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // ── Presigned Upload URL ──────────────────────────────────────────
  server.post("/:id/attachments/presign-upload", async (request, reply) => {
    const session = await requireAuthSession(request, reply);
    if (!session) return;

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = presignUploadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Request body validation failed.", details: parsed.error.flatten() });
    }

    const mimeType = parsed.data.mimeType || "application/octet-stream";
    if (!isAllowedAttachment(parsed.data.fileName, mimeType)) {
      return reply.status(415).send({ code: "ATTACHMENT_UNSUPPORTED", message: "Unsupported file type." });
    }

    try {
      const { url, storageKey } = await getPresignedUploadUrl({
        rfqId: params.data.id,
        quoteRevisionId: parsed.data.quoteRevisionId,
        fileName: parsed.data.fileName,
        mimeType,
        sizeBytes: parsed.data.sizeBytes,
      });

      return reply.status(200).send({ uploadUrl: url, storageKey });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // ── Confirm Upload (after presigned upload completes) ─────────────
  server.post("/:id/attachments/confirm-upload", async (request, reply) => {
    const session = await requireAuthSession(request, reply);
    if (!session) return;

    const role = mapDbRoleToRfqRole(session.user.role);
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = confirmUploadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Request body validation failed.", details: parsed.error.flatten() });
    }

    try {
      const attachment = await rfqStore.addAttachment({
        rfqId: params.data.id,
        quoteRevisionId: parsed.data.quoteRevisionId,
        fileName: parsed.data.fileName,
        mimeType: parsed.data.mimeType,
        sizeBytes: parsed.data.sizeBytes,
        storageKey: parsed.data.storageKey,
        uploadedById: session.user.id,
        uploadedByRole: role,
      });

      return reply.status(201).send(attachment);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // ── Presigned Download URL ────────────────────────────────────────
  server.get("/attachments/:attachmentId/presign-download", async (request, reply) => {
    const session = await requireAuthSession(request, reply);
    if (!session) return;

    const params = z.object({ attachmentId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'attachmentId' must be a valid UUID." });
    }

    const role = mapDbRoleToRfqRole(session.user.role);
    const attachment = await rfqStore.getAttachmentForDownload(params.data.attachmentId, role, session.user.id);

    if (!attachment) {
      return reply.status(404).send({ code: "ATTACHMENT_NOT_FOUND", message: "Attachment was not found." });
    }

    try {
      const { url } = await getPresignedDownloadUrl(attachment.storageKey, attachment.fileName);
      return reply.status(200).send({ downloadUrl: url, fileName: attachment.fileName, mimeType: attachment.mimeType });
    } catch (error) {
      return sendError(reply, error);
    }
  });
};
