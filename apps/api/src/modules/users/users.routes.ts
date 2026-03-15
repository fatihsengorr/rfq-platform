import { Prisma, UserRole } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError, isApiError } from "../../errors.js";
import { prisma } from "../../prisma.js";
import { extractBearerToken, hashPassword, resolveAccessToken, validatePasswordPolicy } from "../auth/auth.service.js";

const updateRoleSchema = z.object({
  role: z.enum(["LONDON_SALES", "ISTANBUL_PRICING", "ISTANBUL_MANAGER", "ADMIN"])
});

const updateActiveSchema = z.object({
  isActive: z.boolean()
});

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  role: z.enum(["LONDON_SALES", "ISTANBUL_PRICING", "ISTANBUL_MANAGER", "ADMIN"]),
  password: z.string().min(1),
  isActive: z.boolean().optional().default(true)
});

const updatePasswordSchema = z.object({
  password: z.string().min(1)
});

function sendError(reply: { status: (code: number) => { send: (body: unknown) => unknown } }, error: unknown) {
  if (isApiError(error)) {
    return reply.status(error.status).send({ code: error.code, message: error.message });
  }

  return reply.status(500).send({ code: "INTERNAL_ERROR", message: "An unexpected server error occurred." });
}

async function requireAdmin(
  request: { headers: { authorization?: string | string[] } },
  reply: { status: (code: number) => { send: (body: unknown) => unknown } }
) {
  const token = extractBearerToken(request.headers.authorization);

  if (!token) {
    sendError(reply, new ApiError("UNAUTHORIZED", "Authentication token is required.", 401));
    return null;
  }

  try {
    const session = await resolveAccessToken(token);

    if (session.user.role !== UserRole.ADMIN) {
      sendError(reply, new ApiError("FORBIDDEN", "Only admin users can access this resource.", 403));
      return null;
    }

    return session;
  } catch (error) {
    sendError(reply, error);
    return null;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapUser(user: {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

export const registerUserRoutes: FastifyPluginAsync = async (server) => {
  server.get("/", async (request, reply) => {
    const session = await requireAdmin(request, reply);

    if (!session) {
      return;
    }

    const users = await prisma.user.findMany({
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return users.map(mapUser);
  });

  server.post("/", async (request, reply) => {
    const session = await requireAdmin(request, reply);

    if (!session) {
      return;
    }

    const parsed = createUserSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    const payload = parsed.data;
    const passwordPolicyError = validatePasswordPolicy(payload.password);

    if (passwordPolicyError) {
      return reply.status(400).send({
        code: "WEAK_PASSWORD",
        message: passwordPolicyError
      });
    }

    try {
      const passwordHash = await hashPassword(payload.password);
      const created = await prisma.user.create({
        data: {
          email: normalizeEmail(payload.email),
          fullName: payload.fullName.trim(),
          role: payload.role,
          isActive: payload.isActive,
          passwordHash
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return reply.status(201).send(mapUser(created));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.status(409).send({ code: "USER_EMAIL_EXISTS", message: "Email is already in use." });
      }

      return sendError(reply, error);
    }
  });

  server.patch("/:id/role", async (request, reply) => {
    const session = await requireAdmin(request, reply);

    if (!session) {
      return;
    }

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = updateRoleSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    try {
      const updated = await prisma.user.update({
        where: {
          id: params.data.id
        },
        data: {
          role: parsed.data.role
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return mapUser(updated);
    } catch {
      return reply.status(404).send({ code: "USER_NOT_FOUND", message: "User not found." });
    }
  });

  server.patch("/:id/active", async (request, reply) => {
    const session = await requireAdmin(request, reply);

    if (!session) {
      return;
    }

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = updateActiveSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    try {
      const updated = await prisma.user.update({
        where: {
          id: params.data.id
        },
        data: {
          isActive: parsed.data.isActive
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return mapUser(updated);
    } catch {
      return reply.status(404).send({ code: "USER_NOT_FOUND", message: "User not found." });
    }
  });

  server.patch("/:id/password", async (request, reply) => {
    const session = await requireAdmin(request, reply);

    if (!session) {
      return;
    }

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);

    if (!params.success) {
      return reply.status(400).send({ code: "INVALID_REQUEST", message: "Route parameter 'id' must be a valid UUID." });
    }

    const parsed = updatePasswordSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    const passwordPolicyError = validatePasswordPolicy(parsed.data.password);

    if (passwordPolicyError) {
      return reply.status(400).send({
        code: "WEAK_PASSWORD",
        message: passwordPolicyError
      });
    }

    try {
      const passwordHash = await hashPassword(parsed.data.password);
      await prisma.user.update({
        where: {
          id: params.data.id
        },
        data: {
          passwordHash
        }
      });

      return reply.status(200).send({ success: true });
    } catch {
      return reply.status(404).send({ code: "USER_NOT_FOUND", message: "User not found." });
    }
  });
};
