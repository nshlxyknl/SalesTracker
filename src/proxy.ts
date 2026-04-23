import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = getSessionCookie(request);

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/sales");

  if (isProtected && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/sales/:path*", "/login", "/signup"],
};
