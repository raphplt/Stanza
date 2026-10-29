import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  if (pathname.startsWith("/studio") || pathname.startsWith("/admin")) {
    if (!sessionCookie) {
      const loginUrl = new URL("/connexion", request.url);
      loginUrl.searchParams.set("retour", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname === "/" && sessionCookie) {
    return NextResponse.redirect(new URL("/studio", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/studio/:path*", "/admin/:path*"],
};
