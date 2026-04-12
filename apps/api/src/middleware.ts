import { UserRole } from "@prisma/client";
import { ApiError, isApiError } from "./errors.js";
import {
  extractBearerToken,
  extractSessionTokenFromCookie,
  resolveAccessToken,
  type AuthSession,
} from "./modules/auth/auth.service.js";

type FastifyReply = { status: (code: number) => { send: (body: unknown) => unknown } };
type FastifyRequest = { headers: { authorization?: string | string[]; cookie?: string } };

/**
 * Serializes an error into a standard JSON response.
 * Handles ApiError instances with their code/status; everything else becomes 500.
 */
export function sendError(reply: FastifyReply, error: unknown) {
  if (isApiError(error)) {
    return reply.status(error.status).send({ code: error.code, message: error.message });
  }
  return reply.status(500).send({ code: "INTERNAL_ERROR", message: "An unexpected server error occurred." });
}

/**
 * Extracts a session token from either the Authorization header or the session cookie.
 */
export function extractRequestToken(request: FastifyRequest): string | null {
  return extractBearerToken(request.headers.authorization) ?? extractSessionTokenFromCookie(request.headers.cookie);
}

/**
 * Requires a valid authenticated session (any role).
 * Returns the session or null (after sending an error response).
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<AuthSession | null> {
  const token = extractRequestToken(request);

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

/**
 * Requires an authenticated session with ADMIN role.
 * Returns the session or null (after sending an error response).
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<AuthSession | null> {
  const session = await requireAuth(request, reply);
  if (!session) return null;

  if (session.user.role !== UserRole.ADMIN) {
    sendError(reply, new ApiError("FORBIDDEN", "Only admin users can access this resource.", 403));
    return null;
  }

  return session;
}

/**
 * Requires an authenticated session with one of the specified roles.
 * Returns the session or null (after sending an error response).
 */
export async function requireRole(
  request: FastifyRequest,
  reply: FastifyReply,
  ...roles: UserRole[]
): Promise<AuthSession | null> {
  const session = await requireAuth(request, reply);
  if (!session) return null;

  if (!roles.includes(session.user.role)) {
    sendError(reply, new ApiError("FORBIDDEN", "You do not have permission to access this resource.", 403));
    return null;
  }

  return session;
}
