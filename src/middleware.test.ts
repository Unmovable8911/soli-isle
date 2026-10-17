import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

function request(
  path: string,
  headers: Record<string, string> = {},
  init: { method?: string } = {},
) {
  return new NextRequest(`http://localhost${path}`, { ...init, headers });
}

describe("locale routing middleware", () => {
  it("redirects the bare path to the Accept-Language choice with 307", () => {
    const response = middleware(request("/", { "accept-language": "en" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/en");
  });

  it("matches the primary subtag of a regional Accept-Language entry", () => {
    const response = middleware(request("/", { "accept-language": "zh-CN,en;q=0.9" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/zh");
  });

  it("prefers the cookie choice over Accept-Language on the bare path", () => {
    const response = middleware(
      request("/", { "accept-language": "en", cookie: "soli-locale=zh" }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/zh");
  });

  it("preserves the query when redirecting an unprefixed page path", () => {
    const response = middleware(request("/about?x=1", { "accept-language": "en" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/en/about?x=1");
  });

  it("never rewrites a prefixed path based on the cookie", () => {
    const response = middleware(request("/zh", { cookie: "soli-locale=en" }));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes API routes through without redirecting", () => {
    const response = middleware(request("/api/health"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes language-shaped prefixes through for the page layer", () => {
    const response = middleware(request("/fr", { "accept-language": "en" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes a supported-Locale compound prefix through despite Accept-Language", () => {
    const response = middleware(request("/zh-Hant", { "accept-language": "en" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes whitelisted static files through without redirecting", () => {
    const response = middleware(request("/logo.svg", { "accept-language": "en" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("admin route middleware", () => {
  it("redirects /admin without a session cookie to /admin/login with 307", () => {
    const response = middleware(request("/admin", { "accept-language": "en" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin/login");
  });

  it("passes /admin through and refreshes the session cookie", () => {
    const response = middleware(
      request("/admin", { cookie: "soli-session=abc", "accept-language": "en" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.cookies.get("soli-session")?.value).toBe("abc");
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("soli-session=abc");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=2592000");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).not.toContain("Secure");
  });

  it("adds Secure to the refreshed cookie over forwarded https", () => {
    const response = middleware(
      request("/admin", {
        cookie: "soli-session=abc",
        "x-forwarded-proto": "https",
      }),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("redirects nested admin paths without a session cookie", () => {
    const response = middleware(request("/admin/foo"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin/login");
  });

  it("passes /admin/login through without a session cookie", () => {
    const response = middleware(request("/admin/login", { "accept-language": "en" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes /admin/login through with a cookie and refreshes it", () => {
    const response = middleware(request("/admin/login", { cookie: "soli-session=abc" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("soli-session=abc");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=2592000");
  });

  it("passes POST /admin/login/submit through without a session cookie", () => {
    const response = middleware(request("/admin/login/submit", {}, { method: "POST" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes POST /admin/logout through without a session cookie", () => {
    const response = middleware(request("/admin/logout", {}, { method: "POST" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes PUT admin writes through without a session cookie", () => {
    const response = middleware(request("/admin/x", {}, { method: "PUT" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("never applies the locale redirect to /admin, cookie or not", () => {
    const withSessionCookie = middleware(
      request("/admin", { cookie: "soli-session=abc", "accept-language": "en" }),
    );
    expect(withSessionCookie.headers.get("location")).toBeNull();

    const withLocaleCookie = middleware(
      request("/admin", { cookie: "soli-locale=en", "accept-language": "en" }),
    );
    expect(withLocaleCookie.headers.get("location")).toBe("http://localhost/admin/login");
    expect(withLocaleCookie.headers.get("location")).not.toBe("http://localhost/zh/admin");

    const withOtherCookies = middleware(
      request("/admin", { cookie: "other=1", "accept-language": "en" }),
    );
    expect(withOtherCookies.headers.get("location")).toBe("http://localhost/admin/login");
  });
});
