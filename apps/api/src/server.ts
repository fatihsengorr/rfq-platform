import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { registerRfqRoutes } from "./modules/rfq/rfq.routes.js";
import { registerUserRoutes } from "./modules/users/users.routes.js";
import { registerCommentRoutes } from "./modules/rfq/comment.routes.js";
import { registerCompanyRoutes } from "./modules/company/company.routes.js";

export function buildServer() {
  const server = Fastify({
    logger: true,
    bodyLimit: 80 * 1024 * 1024
  });

  server.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PATCH"],
    credentials: true
  });

  server.get("/health", async () => ({ status: "ok" }));
  server.register(registerAuthRoutes, { prefix: "/api/auth" });
  server.register(registerRfqRoutes, { prefix: "/api/rfqs" });
  server.register(registerCommentRoutes, { prefix: "/api/rfqs" });
  server.register(registerUserRoutes, { prefix: "/api/users" });
  server.register(registerCompanyRoutes, { prefix: "/api/companies" });

  return server;
}
