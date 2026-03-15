const FALLBACK_APP_WEB_BASE_URL = process.env.APP_WEB_BASE_URL?.replace(/\/+$/, "") ?? null;

export function resolveRequestOrigin(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  if (FALLBACK_APP_WEB_BASE_URL) {
    return FALLBACK_APP_WEB_BASE_URL;
  }

  return new URL(request.url).origin;
}
