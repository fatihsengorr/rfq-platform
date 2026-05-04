/**
 * Next.js 15 instrumentation hook. Runs at server-startup and routes
 * the right Sentry config based on the runtime ("nodejs" or "edge").
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
