import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/cookies";

const PUBLIC_PAGES = new Set(["/", "/sign-in", "/support/diagnostics"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthApi = pathname.startsWith("/api/auth");
  const isHealth = pathname === "/api/health";
  // FAIQ-43 demo only. This path skips the session cookie gate.
  // Every other API and dashboard route stays gated.
  const isSecurityDemo = pathname === "/api/support/diagnostics";
  const isPublic = PUBLIC_PAGES.has(pathname) || isAuthApi || isHealth || isSecurityDemo;
  const signedIn = request.cookies.has(SESSION_COOKIE);

  if (pathname.startsWith("/api/") && !isPublic && !signedIn) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  if (!isPublic && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    if (pathname !== "/") url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/sign-in" && signedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
