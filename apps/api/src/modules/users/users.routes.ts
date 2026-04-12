import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sendError, requireAdmin } from "../../middleware.js";
import { issueInviteToken } from "../auth/auth.service.js";
import { listUsers, createUser, updateRole, updateActive, updatePassword } from "./users.service.js";

const updateRoleSchema = z.object({
  role: z.enum(["LONDON_SALES", "ISTANBUL_PRICING", "ISTANBUL_MANAGER", "ADMIN"]),
});

const updateActiveSchema = z.object({
  isActive: z.boolean(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  role: z.enum(["LONDON_SALES", "ISTANBUL_PRICING", "ISTANBUL_MANAGER", "ADMIN"]),
  password: z.string().min(1).optional(),
  isActive: z.boolean().optional().default(true),
});

const updatePasswordSchema = z.object({
  password: z.string().min(1),
});

export const registerUserRoutes: FastifyPluginAsync = async (server) => {
  server.get("/", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    return await listUsers();
  });

  server.post("/", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten(),
      });
    }

    try {
      const user = await createUser(parsed.data, session.user.fullName);
      return reply.status(201).send(user);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.patch("/:id/role", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = updateRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten(),
      });
    }

    try {
      return await updateRole(params.data.id, parsed.data.role);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.patch("/:id/active", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = updateActiveSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten(),
      });
    }

    try {
      return await updateActive(params.data.id, parsed.data.isActive);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.patch("/:id/password", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = updatePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten(),
      });
    }

    try {
      await updatePassword(params.data.id, parsed.data.password);
      return reply.status(200).send({ success: true });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post("/:id/resend-invite", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    try {
      const result = await issueInviteToken(params.data.id, session.user.fullName);
      return reply.status(200).send(result);
    } catch (error) {
      return sendError(reply, error);
    }
  });
};
