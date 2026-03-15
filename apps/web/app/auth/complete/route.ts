import { NextResponse } from "next/server";
import { consumeLoginHandoff } from "../../../lib/login-handoff";
import { resolveRequestOrigin } from "../../../lib/request-origin";
import { setSessionCookie } from "../../../lib/session";

function redirect(request: Request, destination: string) {
  return NextResponse.redirect(new URL(destination, resolveRequestOrigin(request)), 303);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nonce = url.searchParams.get("nonce");

  if (!nonce) {
    return redirect(request, "/login?error=failed");
  }

  const accessToken = consumeLoginHandoff(nonce);

  if (!accessToken) {
    return redirect(request, "/login?error=failed");
  }

  const response = redirect(request, "/requests");
  setSessionCookie(response, accessToken);
  return response;
}
