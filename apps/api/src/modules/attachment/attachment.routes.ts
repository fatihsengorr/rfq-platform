import type { FastifyPluginAsync } from "fastify";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { sendError, requireRole } from "../../middleware.js";
import {
  presignEntityUpload,
  confirmEntityUpload,
  getCrmAttachmentForDownload,
  removeCrmAttachment,
} from "./attachment.service.js";

const SCOPE = z.enum(["project", "company"]);

const presignSchema = z.object({
  scope: SCOPE,
  entityId: z.string().uuid(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

const confirmSchema = presignSchema.extend({
  storageKey: z.string().min(1),
});

const idParam = z.object({ id: z.string().uuid() });

function toSafeDownloadName(fileName: string): string {
  const normalized = fileName.trim().replaceAll("\\", "/").split("/").at(-1) ?? "attachment";
  const safe = normalized.replaceAll(/[^A-Za-z0-9._-]/g, "_");
  return safe.length > 0 ? safe : "attachment";
}

export const registerAttachmentRoutes: FastifyPluginAsync = async (server) => {
  // Presigned PUT URL for a project/company file.
  server.post("/presign-upload", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;
    const parsed = presignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Validation failed.", details: parsed.error.flatten() });
    }
    try {
      return await presignEntityUpload(parsed.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // Record the attachment row after the client PUT completes.
  server.post("/confirm-upload", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;
    const parsed = confirmSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Validation failed.", details: parsed.error.flatten() });
    }
    try {
      const attachment = await confirmEntityUpload({ ...parsed.data, uploadedById: session.user.id });
      return reply.status(201).send(attachment);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // Download proxy (sales/admin only — CRM is invisible to Istanbul roles).
  server.get("/:id/download", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: "INVALID_REQUEST", message: "Invalid attachment ID." });
    try {
      const attachment = await getCrmAttachmentForDownload(params.data.id);
      reply.header("Content-Type", attachment.contentType || attachment.mimeType || "application/octet-stream");
      reply.header("Content-Disposition", `inline; filename="${toSafeDownloadName(attachment.fileName)}"`);
      return reply.send(attachment.data);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // Remove a wrongly-uploaded CRM file.
  server.post("/:id/remove", async (request, reply) => {
    const session = await requireRole(request, reply, UserRole.LONDON_SALES, UserRole.ADMIN);
    if (!session) return;
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: "INVALID_REQUEST", message: "Invalid attachment ID." });
    try {
      await removeCrmAttachment(params.data.id);
      return reply.status(200).send({ ok: true });
    } catch (error) {
      return sendError(reply, error);
    }
  });
};
