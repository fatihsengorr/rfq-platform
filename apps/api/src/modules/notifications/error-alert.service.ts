/**
 * Direct error → Telegram alerting, bypassing GlitchTip's alert-rule
 * webhook (which proved unreliable on the hosted instance).
 *
 * Errors still go to GlitchTip via the Sentry SDK for dashboard/history;
 * this module is purely the "ping my phone now" path, fired straight from
 * the API's central error handler.
 *
 * De-duplication: the same error hitting 100x/sec must not send 100
 * Telegram messages. We key by a coarse fingerprint (status + route +
 * error name + first line of message) and suppress repeats within a
 * cooldown window, then send a single "+N more" summary is NOT attempted
 * — we just suppress and let GlitchTip's dashboard hold the true count.
 */

import { config } from "../../config.js";
import { logger } from "../../logger.js";
import { sendTelegramMessage, escapeHtml } from "./telegram.service.js";

// Cooldown per unique fingerprint. Within this window, repeat errors with
// the same fingerprint are counted but not re-sent.
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// In-memory dedup map. Process-local — fine for a single API container.
// If we ever scale to multiple API replicas, move this to Redis.
type Seen = { firstAt: number; lastNotifiedAt: number; count: number };
const seen = new Map<string, Seen>();

// Bound the map so a flood of unique errors can't grow it without limit.
const MAX_TRACKED = 500;

function fingerprint(input: {
  status: number;
  route: string;
  errorName: string;
  message: string;
}): string {
  const firstLine = (input.message || "").split("\n")[0].slice(0, 120);
  return `${input.status}|${input.route}|${input.errorName}|${firstLine}`;
}

export type ErrorAlertInput = {
  status: number;
  route: string;
  method: string;
  errorName: string;
  message: string;
  stack?: string;
  requestId?: string;
};

/**
 * Decide whether to send, and if so, fire a Telegram alert. Fire-and-forget
 * from the caller's perspective — never throws, never blocks the response.
 */
export function alertError(input: ErrorAlertInput): void {
  if (!config.telegram.enabled) return;

  const key = fingerprint(input);
  const now = Date.now();
  const existing = seen.get(key);

  if (existing) {
    existing.count += 1;
    // Still within cooldown — suppress.
    if (now - existing.lastNotifiedAt < COOLDOWN_MS) {
      return;
    }
    // Cooldown elapsed — notify again, noting how many we suppressed.
    existing.lastNotifiedAt = now;
    void send(input, existing.count);
    existing.count = 0;
    return;
  }

  // First time we've seen this fingerprint.
  if (seen.size >= MAX_TRACKED) {
    // Evict the oldest entry to keep the map bounded.
    const oldestKey = [...seen.entries()].sort(
      (a, b) => a[1].lastNotifiedAt - b[1].lastNotifiedAt,
    )[0]?.[0];
    if (oldestKey) seen.delete(oldestKey);
  }
  seen.set(key, { firstAt: now, lastNotifiedAt: now, count: 1 });
  void send(input, 1);
}

async function send(input: ErrorAlertInput, occurrences: number): Promise<void> {
  const env = config.sentry.environment;
  const lines = [
    `🚨 <b>API ERROR</b> [${escapeHtml(env)}]`,
    `<b>${escapeHtml(input.errorName)}</b>: ${escapeHtml(input.message.split("\n")[0].slice(0, 300))}`,
    `${escapeHtml(input.method)} <code>${escapeHtml(input.route)}</code> → ${input.status}`,
  ];
  if (occurrences > 1) {
    lines.push(`(${occurrences} occurrences suppressed during cooldown)`);
  }
  if (input.requestId) {
    lines.push(`req: <code>${escapeHtml(input.requestId)}</code>`);
  }

  const result = await sendTelegramMessage(lines.join("\n"));
  if (!result.ok) {
    logger.error({ err: result.error }, "Failed to send error alert to Telegram");
  }
}

// Test-only: reset internal state between unit tests.
export function __resetAlertStateForTests(): void {
  seen.clear();
}
