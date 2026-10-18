import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/config/auth";
import { parseArticlePath } from "@/domain/article-url";
import { decideLocaleRedirect, withLocalePrefix } from "@/domain/locale";
import { normalizeProxyHeaders } from "@/domain/proxy-headers";
import { forwardedProtocol } from "@/domain/urls";
import { goneResponse } from "@/http/gone";
import { NextResponse, type NextRequest } from "next/server";

const TOMBSTONE_TTL_MS = 30_000;

let tombstones: { slugs: ReadonlySet<string>; loadedAt: number } | null = null;

/** Test seam: the cache lives for the lifetime of the Edge isolate. */
export function resetTombstoneCache(): void {
  tombstones = null;
}

/**
 * A permanently deleted Article must answer 410, which a page cannot do. The
 * Edge runtime cannot read SQLite either, so the Node side publishes the
 * tombstones and this keeps a short-lived copy. Any failure fails open: the
 * page then answers 404, which is worse than 410 but never wrong to a Reader.
 */
async function isTombstoned(request: NextRequest, slug: string): Promise<boolean> {
  const now = Date.now();
  if (tombstones === null || now - tombstones.loadedAt >= TOMBSTONE_TTL_MS) {
    try {
      const response = await fetch(new URL("/api/public/gone-slugs", request.url), {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) {
        const payload: unknown = await response.json();
        const slugs = (payload as { slugs?: unknown }).slugs;
        if (Array.isArray(slugs)) {
          tombstones = {
            slugs: new Set(slugs.filter((value): value is string => typeof value === "string")),
            loadedAt: now,
          };
        }
      }
    } catch {
      // Keep whatever we had; a missing list only costs the 410 status.
    }
  }

  return tombstones?.slugs.has(slug) ?? false;
}

export async function middleware(request: NextRequest) {
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

  const article = parseArticlePath(pathname);
  if (article !== null && (request.method === "GET" || request.method === "HEAD")) {
    if (await isTombstoned(request, article.slug)) {
      return goneResponse(article.locale);
    }
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
