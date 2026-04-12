import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sendError, requireAuth } from "../../middleware.js";
import { listComments, createComment } from "./comment.service.js";

const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

export const registerCommentRoutes: FastifyPluginAsync = async (server) => {
  server.get("/:id/comments", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    return await listComments(params.data.id);
  });

  server.post("/:id/comments", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = createCommentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Comment body is required (1-5000 characters).", details: parsed.error.flatten() });
    }

    try {
      const comment = await createComment(params.data.id, parsed.data.body, session.user.id, session.user.fullName);
      return reply.status(201).send(comment);
    } catch (error) {
      return sendError(reply, error);
    }
  });
};
