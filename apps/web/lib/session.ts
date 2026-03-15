import { cookies } from "next/headers";

const SESSION_COOKIE = "rfq_session";
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

function encodeSessionPayload(accessToken: string, user: SessionUser) {
  return Buffer.from(JSON.stringify({ accessToken, user }), "utf8").toString("base64url");
}

function decodeSessionPayload(rawValue: string): { accessToken: string; user: SessionUser } | null {
  try {
    const decoded = Buffer.from(rawValue, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as { accessToken?: string; user?: SessionUser };

    if (!parsed.accessToken || !parsed.user) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      user: parsed.user
    };
  } catch {
    return null;
  }
}

export function setSession(store: CookieAdapter, accessToken: string, user: SessionUser) {
  store.set(SESSION_COOKIE, encodeSessionPayload(accessToken, user), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    maxAge: 60 * 60 * 12
  });

  // Remove legacy split cookies after migrating to a single session cookie.
  store.set(ACCESS_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
  store.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
}

export function clearSession(store: CookieAdapter) {
  store.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  store.set(ACCESS_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
  store.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function getSession(store?: CookieStore) {
  const cookieStore = store ?? (await cookies());
  const rawSession = cookieStore.get(SESSION_COOKIE)?.value ?? null;

  if (rawSession) {
    const parsedSession = decodeSessionPayload(rawSession);

    if (parsedSession) {
      return parsedSession;
    }
  }

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
