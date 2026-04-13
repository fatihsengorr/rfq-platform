import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const publicPaths = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/set-password",
]);

function isPublicPath(pathname: string): boolean {
  // Exact match for public pages
  if (publicPaths.has(pathname)) return true;

  // Next.js internals and static assets
  if (pathname.startsWith("/_next/") || pathname.startsWith("/api/") || pathname.startsWith("/favicon")) return true;

  // Public static files
  if (pathname.includes(".")) return true;

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for next-auth JWT token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_JWT_SECRET ?? "dev-secret-change-me",
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes
  if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
