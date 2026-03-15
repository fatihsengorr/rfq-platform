import { NextResponse } from "next/server";
import { resolveRequestOrigin } from "../../../lib/request-origin";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function redirect(request: Request, destination: string) {
  return NextResponse.redirect(new URL(destination, resolveRequestOrigin(request)), 303);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function redirectDocument(request: Request, destination: string) {
  const targetUrl = new URL(destination, resolveRequestOrigin(request)).toString();
  const escapedTargetUrl = escapeHtml(targetUrl);

  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0;url=${escapedTargetUrl}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting...</title>
  </head>
  <body>
    <p>Redirecting to <a href="${escapedTargetUrl}">${escapedTargetUrl}</a>...</p>
    <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
  </body>
</html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
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

    const response = redirectDocument(request, "/requests");
    const setCookie = apiResponse.headers.get("set-cookie");

    if (setCookie) {
      response.headers.append("set-cookie", setCookie);
    }

    return response;
  } catch {
    return redirect(request, "/login?error=network");
  }
}
