import { describe, expect, it } from "vitest";
import { absoluteUrl, clientAddress, forwardedProtocol, requestUrl } from "./urls";

describe("request URL resolution", () => {
  it("uses the host and forwarded protocol supplied by the proxy", () => {
    const headers = new Headers({
      host: "blog.example.com",
      "x-forwarded-proto": "https, http",
    });

    expect(forwardedProtocol(headers)).toBe("https");
    expect(absoluteUrl("/zh/articles/hello", headers)).toBe(
      "https://blog.example.com/zh/articles/hello",
    );
  });

  it("defaults to plain HTTP when the forwarded protocol is absent or invalid", () => {
    expect(forwardedProtocol(new Headers({ host: "blog.example.com" }))).toBe("http");
    expect(
      forwardedProtocol(
        new Headers({ host: "blog.example.com", "x-forwarded-proto": "ftp" }),
      ),
    ).toBe("http");
  });

  it("never invents a domain when the request did not provide a host", () => {
    const headers = new Headers();

    expect(absoluteUrl("/zh", headers)).toBeNull();
    expect(requestUrl("/zh", headers)).toBe("/zh");
  });

  it("rejects host values that smuggle in another authority", () => {
    expect(
      absoluteUrl("/zh", new Headers({ host: "given.example@evil.example" })),
    ).toBeNull();
    expect(
      absoluteUrl("/zh", new Headers({ host: "evil.example#@given.example" })),
    ).toBeNull();
    expect(absoluteUrl("/zh", new Headers({ host: "given.example/path" }))).toBeNull();
    expect(absoluteUrl("/zh", new Headers({ host: "given.example:invalid" }))).toBeNull();
  });

  it("keeps valid hostnames, ports, and IPv6 authorities", () => {
    expect(absoluteUrl("/zh", new Headers({ host: "Blog.Example:8443" }))).toBe(
      "http://blog.example:8443/zh",
    );
    expect(absoluteUrl("/zh", new Headers({ host: "[::1]:3000" }))).toBe(
      "http://[::1]:3000/zh",
    );
  });

  it("rejects absolute or protocol-relative paths", () => {
    const headers = new Headers({ host: "blog.example.com" });

    expect(() => requestUrl("https://other.example/zh", headers)).toThrow("Expected a relative path");
    expect(() => requestUrl("//other.example/zh", headers)).toThrow("Expected a relative path");
    expect(() => requestUrl("/\\other.example/zh", headers)).toThrow("Expected a relative path");
    expect(() => requestUrl("/zh\nLocation: https://other.example", headers)).toThrow(
      "Expected a relative path",
    );
  });
});

describe("client address resolution", () => {
  it("trusts the first address in X-Forwarded-For", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.8, 10.0.0.4",
      "x-real-ip": "10.0.0.9",
    });

    expect(clientAddress(headers)).toBe("203.0.113.8");
  });

  it("does not trust client address headers outside the documented proxy contract", () => {
    expect(clientAddress(new Headers({ "x-real-ip": "198.51.100.2" }))).toBeNull();
    expect(clientAddress(new Headers())).toBeNull();
  });
});
