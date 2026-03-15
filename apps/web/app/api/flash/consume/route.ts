import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FLASH_COOKIE_NAME, parseFlashPayload } from "../../../../lib/flash";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "";

  const store = await cookies();
  const raw = store.get(FLASH_COOKIE_NAME)?.value;
  const payload = parseFlashPayload(raw);

  const emptyResponse = NextResponse.json({ code: null as string | null });

  if (!payload) {
    if (raw) {
      emptyResponse.cookies.set(FLASH_COOKIE_NAME, "", { path: "/", maxAge: 0 });
    }

    return emptyResponse;
  }

  if (payload.path !== path) {
    return emptyResponse;
  }

  const response = NextResponse.json({ code: payload.code });
  response.cookies.set(FLASH_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
