import { cookies } from "next/headers";

const ACCESS_TOKEN_COOKIE = "crm_access_token";
const USER_COOKIE = "crm_user";
const IS_PROD = process.env.NODE_ENV === "production";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";
};

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export function setSession(store: CookieStore, accessToken: string, user: SessionUser) {
  store.set(ACCESS_TOKEN_COOKIE, accessToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    maxAge: 60 * 60 * 12
  });

  store.set(USER_COOKIE, encodeURIComponent(JSON.stringify(user)), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    maxAge: 60 * 60 * 12
  });
}

export function clearSession(store: CookieStore) {
  store.set(ACCESS_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
  store.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function getSession(store?: CookieStore) {
  const cookieStore = store ?? (await cookies());
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  const rawUser = cookieStore.get(USER_COOKIE)?.value;

  if (!accessToken) {
    return { accessToken: null, user: null as SessionUser | null };
  }

  if (!rawUser) {
    return { accessToken, user: null as SessionUser | null };
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawUser)) as SessionUser;
    return { accessToken, user: parsed };
  } catch {
    return { accessToken, user: null as SessionUser | null };
  }
}
