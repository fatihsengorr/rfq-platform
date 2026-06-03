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
import { alertError } from "./modules/notifications/error-alert.service.js";
import { captureException } from "./sentry.js";
import { isApiError } from "./errors.js";
import { logger } from "./logger.js";
import { prisma } from "./prisma.js";

// Strip sensitive query-string params from any URL we log. Without this,
// Fastify's default request logger emits the raw URL — including things
// like `?token=...` from the GlitchTip webhook — into the logs and any
// downstream log aggregator. Add new keys here as new sensitive query
// params appear.
const SENSITIVE_QUERY_KEYS = ["token", "access_token", "api_key"];
export function redactUrl(url: string | undefined): string {
  if (!url) return "";
  const re = new RegExp(`([?&](?:${SENSITIVE_QUERY_KEYS.join("|")})=)[^&#]+`, "gi");
  return url.replace(re, "$1[redacted]");
}

export function buildServer() {
  const server = Fastify({
    logger: {
      // Keep Fastify's default request/response logging shape, but sanitize
      // the URL before it lands in any log line.
      serializers: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        req(req: any) {
          return {
            method: req.method,
            url: redactUrl(req.url),
            hostname: req.hostname,
            remoteAddress: req.ip ?? req.remoteAddress,
          };
        },
      },
    },
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
      const route = (request as { routeOptions?: { url?: string } }).routeOptions?.url ?? request.url;
      captureException(error, {
        tags: { route },
        extra: {
          method: request.method,
          path: request.url,
          requestId: request.id,
        },
      });
      logger.error({ err: error, method: request.method, path: request.url }, "Unhandled error");
      // Direct Telegram alert (bypasses GlitchTip's unreliable alert-rule
      // webhook). Fire-and-forget, rate-limited per error fingerprint.
      alertError({
        status,
        route,
        method: request.method,
        errorName: (error as Error).name || "Error",
        message: (error as Error).message || "(no message)",
        requestId: String(request.id),
      });
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
