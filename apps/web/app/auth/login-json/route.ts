import { NextResponse } from "next/server";
import { createSessionValue } from "../../../lib/session";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type LoginResponsePayload = {
  accessToken?: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";
  };
};

export async function POST(request: Request) {
  let body: { email?: string; password?: string };

  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ code: "INVALID_REQUEST", message: "Request body must be valid JSON." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "").trim();

  if (!email || !password) {
    return NextResponse.json({ code: "INVALID_REQUEST", message: "Email and password are required." }, { status: 400 });
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

    const payload = (await apiResponse.json()) as LoginResponsePayload & { code?: string; message?: string };

    if (!apiResponse.ok) {
      return NextResponse.json(
        {
          code: payload.code ?? "LOGIN_FAILED",
          message: payload.message ?? "Login failed."
        },
        { status: apiResponse.status }
      );
    }

    if (!payload.accessToken || !payload.user) {
      return NextResponse.json({ code: "LOGIN_FAILED", message: "Login response is incomplete." }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      sessionValue: createSessionValue(payload.accessToken, payload.user),
      redirectTo: "/requests"
    });
  } catch {
    return NextResponse.json({ code: "NETWORK_ERROR", message: "API is unreachable." }, { status: 503 });
  }
}
