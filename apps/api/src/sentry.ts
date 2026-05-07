/**
 * Sentry / GlitchTip initialisation for the API.
 *
 * Must be imported BEFORE everything else in main.ts so the SDK can hook
 * into Node's uncaught exception / unhandled rejection handlers.
 *
 * GlitchTip is wire-compatible with Sentry, so we use the standard
 * @sentry/node SDK and just point the DSN at GlitchTip.
 */

import * as Sentry from "@sentry/node";
import { config } from "./config.js";

let initialised = false;

export function initSentry(): void {
  if (initialised) return;
  initialised = true;

  if (!config.sentry.dsn) {
    // No DSN configured — running locally / in tests. Skip silently.
    return;
  }

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    release: config.sentry.release,

    // Sample 10% of transactions for tracing in prod, all in dev.
    tracesSampleRate: config.isProd ? 0.1 : 1.0,

    // Don't send local-machine errors as production noise.
    enabled: !!config.sentry.dsn,

    // Strip the secrets from error payloads so we never leak them.
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
        delete event.request.headers["x-cron-secret"];
      }
      // Also strip token-like query params from the request URL, e.g.
      // /api/notifications/glitchtip?token=... should never appear in
      // an error payload at GlitchTip.
      if (event.request?.url) {
        event.request.url = event.request.url.replace(
          /([?&](?:token|access_token|api_key)=)[^&#]+/gi,
          "$1[redacted]",
        );
      }
      if (event.request?.query_string && typeof event.request.query_string === "string") {
        event.request.query_string = event.request.query_string.replace(
          /((?:^|&)(?:token|access_token|api_key)=)[^&]+/gi,
          "$1[redacted]",
        );
      }
      return event;
    },
  });
}

// Re-export the parts of Sentry the rest of the code needs so they don't
// have to import the SDK directly.
export const captureException = Sentry.captureException;
export const captureMessage = Sentry.captureMessage;
export const setUser = Sentry.setUser;
export const flush = Sentry.flush;
