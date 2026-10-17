import { describe, expect, it } from "vitest";
import {
  resolveAuthConfig,
  SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS,
  SESSION_TTL_SECONDS,
} from "./auth";

describe("author auth configuration", () => {
  it("publishes the session constants shared with the HTTP layer", () => {
    expect(SESSION_COOKIE_NAME).toBe("soli-session");
    expect(SESSION_TTL_DAYS).toBe(30);
    expect(SESSION_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
  });

  it("falls back to an unset, closed auth surface", () => {
    expect(resolveAuthConfig({ NODE_ENV: "test" })).toEqual({
      passwordHash: null,
      totpSecret: null,
      sessionTtlDays: SESSION_TTL_DAYS,
      throttle: {
        windowMs: 15 * 60_000,
        failureThreshold: 3,
        backoffBaseMs: 30_000,
        backoffCapMs: 30 * 60_000,
        globalWindowMs: 10 * 60_000,
        globalFailureThreshold: 20,
        globalBackoffBaseMs: 5 * 60_000,
        globalBackoffCapMs: 60 * 60_000,
      },
    });
  });

  it("reads the configured password hash and TOTP secret", () => {
    const config = resolveAuthConfig({ NODE_ENV: "test",
      AUTHOR_PASSWORD_HASH: "  $argon2id$example  ",
      AUTHOR_TOTP_SECRET: "  JBSWY3DPEHPK3PXP  ",
    });

    expect(config.passwordHash).toBe("$argon2id$example");
    expect(config.totpSecret).toBe("JBSWY3DPEHPK3PXP");
  });

  it("treats empty or whitespace-only values as unset", () => {
    expect(resolveAuthConfig({ NODE_ENV: "test", AUTHOR_PASSWORD_HASH: "" }).passwordHash).toBeNull();
    expect(resolveAuthConfig({ NODE_ENV: "test", AUTHOR_PASSWORD_HASH: "   " }).passwordHash).toBeNull();
    expect(resolveAuthConfig({ NODE_ENV: "test", AUTHOR_TOTP_SECRET: "" }).totpSecret).toBeNull();
    expect(resolveAuthConfig({ NODE_ENV: "test", AUTHOR_TOTP_SECRET: " \t " }).totpSecret).toBeNull();
  });

  it("resolves a fresh throttle object per call", () => {
    const first = resolveAuthConfig({ NODE_ENV: "test" }).throttle;
    const second = resolveAuthConfig({ NODE_ENV: "test" }).throttle;
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
