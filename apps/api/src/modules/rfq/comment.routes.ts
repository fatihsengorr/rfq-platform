import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { ApiError, isApiError } from "../../errors.js";
import { extractBearerToken, resolveAccessToken } from "../auth/auth.service.js";
import { sendNotification } from "../email/email.service.js";
import { newCommentNotification } from "../email/email.templates.js";

const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

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

export const registerCommentRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/rfqs/:id/comments — list comments for an RFQ
  server.get("/:id/comments", async (request, reply) => {
    const session = await requireAuthSession(request, reply);
    if (!session) return;

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const comments = await prisma.comment.findMany({
      where: { rfqId: params.data.id },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: {
        id: c.author.id,
        fullName: c.author.fullName,
        role: c.author.role,
      },
    }));
  });

  // POST /api/rfqs/:id/comments — add a comment to an RFQ
  server.post("/:id/comments", async (request, reply) => {
    const session = await requireAuthSession(request, reply);
    if (!session) return;

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = createCommentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Comment body is required (1-5000 characters).", details: parsed.error.flatten() });
    }

    // Verify RFQ exists
    const rfq = await prisma.rfq.findUnique({
      where: { id: params.data.id },
      select: { id: true, projectName: true, createdById: true, assignedPricingUserId: true },
    });

    if (!rfq) {
      return reply.status(404).send({ code: "RFQ_NOT_FOUND", message: "RFQ record was not found." });
    }

    const comment = await prisma.comment.create({
      data: {
        body: parsed.data.body,
        rfqId: params.data.id,
        authorId: session.user.id,
      },
      include: {
        author: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    // Email: notify all stakeholders except the comment author
    const webBase = process.env.APP_WEB_BASE_URL ?? "http://localhost:3000";
    const rfqUrl = `${webBase}/requests/${params.data.id}`;

    // Collect unique stakeholder IDs: creator + assigned pricing + all managers
    const recipientIds = new Set<string>();
    if (rfq.createdById) recipientIds.add(rfq.createdById);
    if (rfq.assignedPricingUserId) recipientIds.add(rfq.assignedPricingUserId);

    // Add all managers
    const managers = await prisma.user.findMany({
      where: { role: "ISTANBUL_MANAGER", isActive: true },
      select: { id: true },
    });
    managers.forEach((m) => recipientIds.add(m.id));

    // Remove comment author
    recipientIds.delete(session.user.id);

    // Send notifications
    for (const recipientId of recipientIds) {
      const user = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { id: true, email: true, fullName: true },
      });
      if (user) {
        const tpl = newCommentNotification(rfq.projectName, session.user.fullName, parsed.data.body, rfqUrl);
        sendNotification({ type: "NEW_COMMENT", recipientId: user.id, recipientEmail: user.email, rfqId: params.data.id, ...tpl });
      }
    }

    return reply.status(201).send({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      author: {
        id: comment.author.id,
        fullName: comment.author.fullName,
        role: comment.author.role,
      },
    });
  });
};
