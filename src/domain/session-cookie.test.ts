import { describe, expect, it } from "vitest";
import { serializeSessionCookie, serializeSessionCookieClear } from "./session-cookie";

describe("serializeSessionCookie", () => {
  it("serializes the session attributes without Secure over plain http", () => {
    const cookie = serializeSessionCookie("soli-session", "abc123", 2592000, false);

    expect(cookie).toContain("soli-session=abc123");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });

  it("adds Secure when the request was forwarded over https", () => {
    const cookie = serializeSessionCookie("soli-session", "abc123", 2592000, true);

    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });
});

describe("serializeSessionCookieClear", () => {
  it("expires the cookie with the session attributes without Secure over plain http", () => {
    const cookie = serializeSessionCookieClear("soli-session", false);

    expect(cookie).toContain("soli-session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });

  it("adds Secure when the request was forwarded over https", () => {
    const cookie = serializeSessionCookieClear("soli-session", true);

    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  });
});
