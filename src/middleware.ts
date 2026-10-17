import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/config/auth";
import { decideLocaleRedirect, withLocalePrefix } from "@/domain/locale";
import { normalizeProxyHeaders } from "@/domain/proxy-headers";
import { forwardedProtocol } from "@/domain/urls";
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return adminPassThrough(request);
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const isReadRequest = request.method === "GET" || request.method === "HEAD";
    if (isReadRequest && !request.cookies.has(SESSION_COOKIE_NAME)) {
      return NextResponse.redirect(new URL("/admin/login", request.url), 307);
    }
    return adminPassThrough(request);
  }

  const preferredLocale = request.cookies.get("soli-locale")?.value ?? null;
  const locale = decideLocaleRedirect(
    pathname,
    request.headers.get("accept-language"),
    preferredLocale,
  );

  if (locale !== null) {
    const url = request.nextUrl.clone();
    url.pathname = withLocalePrefix(pathname, locale);
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next({ request: { headers: normalizeProxyHeaders(request.headers) } });
}

function adminPassThrough(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: normalizeProxyHeaders(request.headers) },
  });
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  if (sessionCookie) {
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie.value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
      secure: forwardedProtocol(request.headers) === "https",
    });
  }
  return response;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
