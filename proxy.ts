import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

import { SESSION_COOKIE } from "@/lib/auth-shared";

/**
 * Redirects unauthenticated visitors away from /admin.
 *
 * This is a UX convenience, NOT an authorization boundary. Role checks and the
 * authoritative session lookup live in `lib/auth.ts` (`requireUser`), called
 * inside each page/action/handler next to the data access. Deliberately does
 * not import the db layer — proxy runs on every matched request and should
 * stay light.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The login page must stay reachable without a session.
  if (pathname === "/admin/login") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return redirectToLogin(request);

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Misconfiguration: fail closed rather than letting everyone through.
    return redirectToLogin(request);
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    return NextResponse.next();
  } catch {
    return redirectToLogin(request);
  }
}

function redirectToLogin(request: NextRequest) {
  const url = new URL("/admin/login", request.url);
  // Preserve where they were headed so login can bounce them back.
  const target = request.nextUrl.pathname + request.nextUrl.search;
  if (target && target !== "/admin") url.searchParams.set("next", target);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
