import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { middleware, resetTombstoneCache } from "./middleware";

function request(
  path: string,
  headers: Record<string, string> = {},
  init: { method?: string } = {},
) {
  return new NextRequest(`http://localhost${path}`, { ...init, headers });
}

describe("locale routing middleware", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetTombstoneCache();
  });

  it("redirects the bare path to the Accept-Language choice with 307", async () => {
    const response = await middleware(request("/", { "accept-language": "en" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/en");
  });

  it("matches the primary subtag of a regional Accept-Language entry", async () => {
    const response = await middleware(request("/", { "accept-language": "zh-CN,en;q=0.9" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/zh");
  });

  it("prefers the cookie choice over Accept-Language on the bare path", async () => {
    const response = await middleware(
      request("/", { "accept-language": "en", cookie: "soli-locale=zh" }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/zh");
  });

  it("preserves the query when redirecting an unprefixed page path", async () => {
    const response = await middleware(request("/about?x=1", { "accept-language": "en" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/en/about?x=1");
  });

  it("never rewrites a prefixed path based on the cookie", async () => {
    const response = await middleware(request("/zh", { cookie: "soli-locale=en" }));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes API routes through without redirecting", async () => {
    const response = await middleware(request("/api/health"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes language-shaped prefixes through for the page layer", async () => {
    const response = await middleware(request("/fr", { "accept-language": "en" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes a supported-Locale compound prefix through despite Accept-Language", async () => {
    const response = await middleware(request("/zh-Hant", { "accept-language": "en" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes whitelisted static files through without redirecting", async () => {
    const response = await middleware(request("/logo.svg", { "accept-language": "en" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("admin route middleware", () => {
  it("redirects /admin without a session cookie to /admin/login with 307", async () => {
    const response = await middleware(request("/admin", { "accept-language": "en" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin/login");
  });

  it("passes /admin through and refreshes the session cookie", async () => {
    const response = await middleware(
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

  it("adds Secure to the refreshed cookie over forwarded https", async () => {
    const response = await middleware(
      request("/admin", {
        cookie: "soli-session=abc",
        "x-forwarded-proto": "https",
      }),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("redirects nested admin paths without a session cookie", async () => {
    const response = await middleware(request("/admin/foo"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin/login");
  });

  it("passes /admin/login through without a session cookie", async () => {
    const response = await middleware(request("/admin/login", { "accept-language": "en" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes /admin/login through with a cookie and refreshes it", async () => {
    const response = await middleware(request("/admin/login", { cookie: "soli-session=abc" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("soli-session=abc");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=2592000");
  });

  it("passes POST /admin/login/submit through without a session cookie", async () => {
    const response = await middleware(request("/admin/login/submit", {}, { method: "POST" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes POST /admin/logout through without a session cookie", async () => {
    const response = await middleware(request("/admin/logout", {}, { method: "POST" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes PUT admin writes through without a session cookie", async () => {
    const response = await middleware(request("/admin/x", {}, { method: "PUT" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("never applies the locale redirect to /admin, cookie or not", async () => {
    const withSessionCookie = await middleware(
      request("/admin", { cookie: "soli-session=abc", "accept-language": "en" }),
    );
    expect(withSessionCookie.headers.get("location")).toBeNull();

    const withLocaleCookie = await middleware(
      request("/admin", { cookie: "soli-locale=en", "accept-language": "en" }),
    );
    expect(withLocaleCookie.headers.get("location")).toBe("http://localhost/admin/login");
    expect(withLocaleCookie.headers.get("location")).not.toBe("http://localhost/zh/admin");

    const withOtherCookies = await middleware(
      request("/admin", { cookie: "other=1", "accept-language": "en" }),
    );
    expect(withOtherCookies.headers.get("location")).toBe("http://localhost/admin/login");
  });
});

describe("permanently removed articles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubTombstones(slugs: string[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ slugs })),
    );
  }

  it("answers 410 for a Slug a permanently deleted Article left behind", async () => {
    stubTombstones(["gone-slug"]);
    resetTombstoneCache();

    const response = await middleware(request("/zh/articles/gone-slug"));

    expect(response.status).toBe(410);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    await expect(response.text()).resolves.toContain("已被永久移除");
  });

  it("lets a live Article through to the page layer", async () => {
    stubTombstones(["gone-slug"]);
    resetTombstoneCache();

    const response = await middleware(request("/en/articles/live-slug"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("asks for the tombstone list once per cache window, not on every path", async () => {
    stubTombstones([]);
    resetTombstoneCache();
    const spy = vi.mocked(globalThis.fetch);

    await middleware(request("/zh"));
    await middleware(request("/zh/articles/one"));
    await middleware(request("/zh/articles/two"));

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("fails open when the list cannot be loaded, so the page still answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    resetTombstoneCache();

    const response = await middleware(request("/zh/articles/anything"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
