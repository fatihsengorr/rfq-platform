/**
 * Server-side Sentry / GlitchTip initialisation for the Next.js app.
 * Loaded automatically by @sentry/nextjs at server boot.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}
