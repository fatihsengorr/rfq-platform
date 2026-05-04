/**
 * Sends a short text message to the configured Telegram chat.
 *
 * Used as the delivery channel for GlitchTip alert webhooks (so a new
 * production error pings the user's phone within seconds), and is also
 * available for any future ops-style alerts (deploy succeeded, daily
 * digest, etc.).
 */

import { config } from "../../config.js";
import { logger } from "../../logger.js";

type SendResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendTelegramMessage(text: string): Promise<SendResult> {
  if (!config.telegram.enabled) {
    logger.warn("Telegram not configured; skipping message");
    return { ok: false, error: "TELEGRAM_NOT_CONFIGURED" };
  }

  const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;
  // Telegram caps a message at 4096 chars. Truncate well before that so we
  // leave room for the parse_mode HTML wrapper safety margin.
  const truncated = text.length > 3800 ? text.slice(0, 3800) + "\n…(truncated)" : text;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegram.chatId,
        text: truncated,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.error({ status: response.status, body }, "Telegram API rejected message");
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return { ok: true };
  } catch (err) {
    logger.error({ err }, "Telegram send failed");
    return { ok: false, error: (err as Error).message };
  }
}

// Escapes characters that would break Telegram's HTML parse mode.
// We use HTML mode (not Markdown) because issue titles may contain *_~`
// which are easy to mishandle.
export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
