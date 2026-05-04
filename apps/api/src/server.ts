import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { config } from "./config.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { registerRfqRoutes } from "./modules/rfq/rfq.routes.js";
import { registerUserRoutes } from "./modules/users/users.routes.js";
import { registerCommentRoutes } from "./modules/rfq/comment.routes.js";
import { registerCompanyRoutes } from "./modules/company/company.routes.js";
import { registerSearchRoutes } from "./modules/search/search.routes.js";
import { registerCronRoutes } from "./modules/cron/cron.routes.js";
import { registerNotificationRoutes } from "./modules/notifications/notifications.routes.js";
import { captureException } from "./sentry.js";
import { isApiError } from "./errors.js";
import { logger } from "./logger.js";
import { prisma } from "./prisma.js";

export function buildServer() {
  const server = Fastify({
    logger: true,
    bodyLimit: 80 * 1024 * 1024
  });

  // Security headers
  server.register(helmet, {
    contentSecurityPolicy: false, // CSP managed by Next.js / Caddy
  });

  // CORS — only allow requests from the web app
  server.register(cors, {
    origin: config.webBaseUrl,
    methods: ["GET", "POST", "PATCH", "PUT"],
    credentials: true
  });

  // Global rate limit: 100 req/min per IP
  server.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // Health checks
  server.get("/health", async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "connected", timestamp: new Date().toISOString() };
    } catch {
      return { status: "degraded", db: "disconnected", timestamp: new Date().toISOString() };
    }
  });
  server.get("/health/live", async () => ({ status: "ok" }));

  // Centralised error handler — sends every unexpected error to Sentry
  // (with request context) and returns a sanitised JSON response.
  // ApiError (deliberate 4xx) is handled by sendError in middleware and
  // never reaches this hook, so we only see actual bugs here.
  server.setErrorHandler((error, request, reply) => {
    // Don't double-report 4xx (validation, auth) — only true 5xx.
    const fastifyError = error as { statusCode?: number; message?: string };
    const status = fastifyError.statusCode ?? 500;
    if (status >= 500 && !isApiError(error)) {
      captureException(error, {
        tags: { route: (request as { routeOptions?: { url?: string } }).routeOptions?.url ?? request.url },
        extra: {
          method: request.method,
          path: request.url,
          requestId: request.id,
        },
      });
      logger.error({ err: error, method: request.method, path: request.url }, "Unhandled error");
    }
    reply.status(status).send({
      code: "INTERNAL_ERROR",
      message: status >= 500 ? "An unexpected error occurred." : (fastifyError.message ?? "Error"),
    });
  });

  // Test endpoint to verify Sentry+Telegram pipeline. Only exposed in
  // non-production (or behind admin auth) so it's not abusable.
  if (!config.isProd || process.env.ENABLE_DEBUG_ROUTES === "true") {
    server.get("/debug/throw", async () => {
      throw new Error("Sentry test error — if you see this in Telegram, the pipeline works.");
    });
  }

  server.register(registerAuthRoutes, { prefix: "/api/auth" });
  server.register(registerRfqRoutes, { prefix: "/api/rfqs" });
  server.register(registerCommentRoutes, { prefix: "/api/rfqs" });
  server.register(registerUserRoutes, { prefix: "/api/users" });
  server.register(registerCompanyRoutes, { prefix: "/api/companies" });
  server.register(registerSearchRoutes, { prefix: "/api/search" });
  server.register(registerCronRoutes, { prefix: "/api/cron" });
  server.register(registerNotificationRoutes, { prefix: "/api/notifications" });

  return server;
}
