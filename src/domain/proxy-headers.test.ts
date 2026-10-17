import { describe, expect, it } from "vitest";
import { normalizeProxyHeaders } from "./proxy-headers";

describe("trusted proxy headers", () => {
  it("normalizes the forwarded address chain and protocol for downstream handlers", () => {
    const normalized = normalizeProxyHeaders(
      new Headers({
        "x-forwarded-for": "203.0.113.8, 10.0.0.4",
        "x-forwarded-proto": "https, http",
      }),
    );

    expect(normalized.get("x-forwarded-for")).toBe("203.0.113.8");
    expect(normalized.get("x-forwarded-proto")).toBe("https");
  });

  it("does not retain a forwarded address the outer proxy did not provide", () => {
    const normalized = normalizeProxyHeaders(
      new Headers({
        "x-real-ip": "198.51.100.2",
      }),
    );

    expect(normalized.get("x-forwarded-for")).toBeNull();
    expect(normalized.get("x-forwarded-proto")).toBe("http");
  });
});
