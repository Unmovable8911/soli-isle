import { decideLocaleRedirect, withLocalePrefix } from "@/domain/locale";
import { normalizeProxyHeaders } from "@/domain/proxy-headers";
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
