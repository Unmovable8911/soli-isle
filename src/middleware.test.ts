import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { headers });
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
