/**
 * Cron / scheduled task endpoints.
 *
 * Protected by CRON_SECRET header — only the systemd timer (or manual curl)
 * should call these. Not accessible to regular users.
 */
import type { FastifyPluginAsync } from "fastify";
import { config } from "../../config.js";
import { runDeadlineReminders } from "./deadline-reminder.service.js";
import { runStallDetection } from "./stall-detection.service.js";

export const registerCronRoutes: FastifyPluginAsync = async (server) => {
  // Auth guard: require X-Cron-Secret header
  server.addHook("onRequest", async (request, reply) => {
    const secret = request.headers["x-cron-secret"];

    if (!config.cronSecret) {
      return reply.status(503).send({
        code: "CRON_NOT_CONFIGURED",
        message: "CRON_SECRET environment variable is not set.",
      });
    }

    if (secret !== config.cronSecret) {
      return reply.status(401).send({
        code: "UNAUTHORIZED",
        message: "Invalid or missing X-Cron-Secret header.",
      });
    }
  });

  server.post("/deadline-reminders", async (_request, reply) => {
    const result = await runDeadlineReminders();
    return reply.status(200).send(result);
  });

  // Faz 3 — Feature 3: Daily scan for RFQs sitting silent in QUOTED too long.
  server.post("/stall-detection", async (_request, reply) => {
    const result = await runStallDetection();
    return reply.status(200).send(result);
  });
};
