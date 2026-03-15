import { NextResponse } from "next/server";
import { resolveRequestOrigin } from "../../../lib/request-origin";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

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

    const response = redirect(request, "/requests");
    const setCookie = apiResponse.headers.get("set-cookie");

    if (setCookie) {
      response.headers.append("set-cookie", setCookie);
    }

    return response;
  } catch {
    return redirect(request, "/login?error=network");
  }
}
