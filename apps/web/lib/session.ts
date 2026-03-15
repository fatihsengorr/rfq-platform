import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const SESSION_COOKIE = "rfq_session";
const LEGACY_ACCESS_TOKEN_COOKIE = "crm_access_token";
const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const IS_PROD = process.env.NODE_ENV === "production";
const SESSION_MAX_AGE = 60 * 60 * 12;

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";
};

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type CookieOptions = {
  path: string;
  httpOnly?: boolean;
  sameSite?: "lax";
  secure?: boolean;
  maxAge?: number;
};
type CookieAdapter = {
  set: (name: string, value: string, options: CookieOptions) => unknown;
};

export function clearSession(store: CookieAdapter) {
  store.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  store.set(LEGACY_ACCESS_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
  store.set("crm_user", "", { path: "/", maxAge: 0 });
}

export function setSessionCookie(response: NextResponse, accessToken: string) {
  response.cookies.set(SESSION_COOKIE, accessToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    maxAge: SESSION_MAX_AGE
  });
}

async function fetchCurrentUser(accessToken: string): Promise<SessionUser | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { user?: SessionUser };
    return payload.user ?? null;
  } catch {
    return null;
  }
}

export async function getSession(store?: CookieStore) {
  const cookieStore = store ?? (await cookies());
  const accessToken =
    cookieStore.get(SESSION_COOKIE)?.value ??
    cookieStore.get(LEGACY_ACCESS_TOKEN_COOKIE)?.value ??
    null;

  if (!accessToken) {
    return { accessToken: null, user: null as SessionUser | null };
  }

  const user = await fetchCurrentUser(accessToken);

  if (!user) {
    return { accessToken: null, user: null as SessionUser | null };
  }

  return { accessToken, user };
}
