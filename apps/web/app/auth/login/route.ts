import { NextResponse } from "next/server";
import { resolveRequestOrigin } from "../../../lib/request-origin";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const ACCESS_TOKEN_COOKIE = "crm_access_token";
const USER_COOKIE = "crm_user";
const IS_PROD = process.env.NODE_ENV === "production";

type LoginResponsePayload = {
  accessToken?: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";
  };
};

function redirect(request: Request, destination: string) {
  return NextResponse.redirect(new URL(destination, resolveRequestOrigin(request)), 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    return redirect(request, "/login?error=missing");
  }

  try {
    const apiResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store"
    });

    if (apiResponse.status === 401) {
      return redirect(request, "/login?error=invalid");
    }

    if (apiResponse.status === 403) {
      return redirect(request, "/login?error=inactive");
    }

    if (!apiResponse.ok) {
      return redirect(request, "/login?error=failed");
    }

    const payload = (await apiResponse.json()) as LoginResponsePayload;

    if (!payload.accessToken || !payload.user) {
      return redirect(request, "/login?error=failed");
    }

    const response = redirect(request, "/requests");

    response.cookies.set(ACCESS_TOKEN_COOKIE, payload.accessToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD,
      maxAge: 60 * 60 * 12
    });

    response.cookies.set(USER_COOKIE, encodeURIComponent(JSON.stringify(payload.user)), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD,
      maxAge: 60 * 60 * 12
    });

    return response;
  } catch {
    return redirect(request, "/login?error=network");
  }
}
