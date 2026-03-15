import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ApiError, isApiError } from "../../errors.js";
import {
  changeOwnPassword,
  extractSessionTokenFromCookie,
  extractBearerToken,
  issuePasswordReset,
  loginWithPassword,
  revokeAccessToken,
  resetPasswordWithToken,
  resolveAccessToken,
  SESSION_COOKIE_NAME
} from "./auth.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1)
});

const IS_PROD = process.env.NODE_ENV === "production";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function buildSessionCookie(token: string) {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${IS_PROD ? "; Secure" : ""}`;
}

function buildClearedSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${IS_PROD ? "; Secure" : ""}`;
}

function extractRequestToken(request: { headers: { authorization?: string | string[]; cookie?: string } }) {
  return extractBearerToken(request.headers.authorization) ?? extractSessionTokenFromCookie(request.headers.cookie);
}

function sendError(reply: { status: (code: number) => { send: (body: unknown) => unknown } }, error: unknown) {
  if (isApiError(error)) {
    return reply.status(error.status).send({ code: error.code, message: error.message });
  }

  return reply.status(500).send({ code: "INTERNAL_ERROR", message: "An unexpected server error occurred." });
}

export const registerAuthRoutes: FastifyPluginAsync = async (server) => {
  server.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    try {
      const result = await loginWithPassword(parsed.data.email, parsed.data.password);
      reply.header("Set-Cookie", buildSessionCookie(result.accessToken));
      return reply.status(200).send(result);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post("/logout", async (request, reply) => {
    const token = extractRequestToken(request);

    if (token) {
      await revokeAccessToken(token);
    }

    reply.header("Set-Cookie", buildClearedSessionCookie());
    return reply.status(200).send({ success: true });
  });

  server.post("/forgot-password", async (request, reply) => {
    const parsed = forgotPasswordSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    try {
      const result = await issuePasswordReset(parsed.data.email);
      return reply.status(200).send(result);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.post("/reset-password", async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    try {
      const result = await resetPasswordWithToken(parsed.data);
      return reply.status(200).send(result);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.patch("/change-password", async (request, reply) => {
    const token = extractRequestToken(request);

    if (!token) {
      return sendError(reply, new ApiError("UNAUTHORIZED", "Authentication token is required.", 401));
    }

    const parsed = changePasswordSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        code: "INVALID_REQUEST",
        message: "Request body validation failed.",
        details: parsed.error.flatten()
      });
    }

    try {
      const session = await resolveAccessToken(token);
      const result = await changeOwnPassword(session.user.id, parsed.data.currentPassword, parsed.data.newPassword);
      return reply.status(200).send(result);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  server.get("/me", async (request, reply) => {
    const token = extractRequestToken(request);

    if (!token) {
      return sendError(reply, new ApiError("UNAUTHORIZED", "Authentication token is required.", 401));
    }

    try {
      const session = await resolveAccessToken(token);
      return reply.status(200).send(session);
    } catch (error) {
      return sendError(reply, error);
    }
  });
};
