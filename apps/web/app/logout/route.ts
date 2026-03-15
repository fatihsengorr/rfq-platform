import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearSession } from "../../lib/session";

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

  clearSession(store);

  return NextResponse.redirect(new URL(nextPath, url.origin));
}
