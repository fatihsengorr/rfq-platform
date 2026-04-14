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

  server.register(registerAuthRoutes, { prefix: "/api/auth" });
  server.register(registerRfqRoutes, { prefix: "/api/rfqs" });
  server.register(registerCommentRoutes, { prefix: "/api/rfqs" });
  server.register(registerUserRoutes, { prefix: "/api/users" });
  server.register(registerCompanyRoutes, { prefix: "/api/companies" });

  return server;
}
