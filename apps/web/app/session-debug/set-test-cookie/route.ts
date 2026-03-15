import { NextResponse } from "next/server";
import { resolveRequestOrigin } from "../../../lib/request-origin";

const IS_PROD = process.env.NODE_ENV === "production";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/session-debug", resolveRequestOrigin(request)), 303);

  response.cookies.set("probe_insecure", "1", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: false,
    maxAge: 60 * 10
  });

  response.cookies.set("probe_secure", "1", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: IS_PROD,
    maxAge: 60 * 10
  });

  response.cookies.set("probe_http_only", "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    maxAge: 60 * 10
  });

  return response;
}
