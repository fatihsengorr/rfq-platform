import type { FastifyPluginAsync } from "fastify";
import { config } from "../../config.js";
import { logger } from "../../logger.js";
import { sendTelegramMessage } from "./telegram.service.js";
import {
  formatGlitchTipMessage,
  type GlitchTipPayload,
} from "./glitchtip-webhook.js";

/**
 * Routes for outbound ops notifications.
 *
 * - POST /api/notifications/glitchtip
 *     Receives an alert webhook from GlitchTip and forwards a formatted
 *     message to the configured Telegram chat. Authenticated by a shared
 *     secret in the URL ("?token=...") that lives in GlitchTip's webhook
 *     config — keeps random callers from spamming the chat.
 */
export const registerNotificationRoutes: FastifyPluginAsync = async (server) => {
  server.post("/glitchtip", async (request, reply) => {
    // Constant-time-ish secret check. The secret is in the URL because
    // GlitchTip's outgoing webhook config doesn't let us add headers.
    const query = request.query as { token?: string };
    if (!config.telegram.webhookSecret) {
      return reply
        .status(503)
        .send({ code: "WEBHOOK_NOT_CONFIGURED", message: "Webhook secret not configured" });
    }
    if (query.token !== config.telegram.webhookSecret) {
      logger.warn({ ip: request.ip }, "Rejected GlitchTip webhook with bad token");
      return reply.status(401).send({ code: "UNAUTHORIZED", message: "Invalid token" });
    }

    if (!config.telegram.enabled) {
      // Acknowledge so GlitchTip doesn't keep retrying, but log.
      logger.warn("Telegram disabled; dropping GlitchTip webhook");
      return reply.status(204).send();
    }

    const payload = request.body as GlitchTipPayload;
    const text = formatGlitchTipMessage(payload);

    const result = await sendTelegramMessage(text);
    if (!result.ok) {
      logger.error({ err: result.error }, "Failed to forward GlitchTip alert to Telegram");
      // Returning 500 lets GlitchTip retry (good for transient Telegram outages).
      return reply.status(500).send({ code: "TELEGRAM_FAILED", message: result.error });
    }

    return reply.status(200).send({ ok: true });
  });
};
