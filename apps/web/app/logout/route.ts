import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveRequestOrigin } from "../../lib/request-origin";
import { clearSession, getSession } from "../../lib/session";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function resolveNextPath(candidate: string | null) {
  if (!candidate || !candidate.startsWith("/")) {
    return "/login";
  }

  return candidate;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = resolveNextPath(url.searchParams.get("next"));
  const store = await cookies();
  const session = await getSession(store);

  if (session.accessToken) {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        },
        cache: "no-store"
      });
    } catch {
      // Best-effort logout; local cookie cleanup below still ends the browser session.
    }
  }

  clearSession(store);

  return NextResponse.redirect(new URL(nextPath, resolveRequestOrigin(request)));
}
