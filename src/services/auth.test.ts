import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveAuthConfig } from "@/config/auth";
import {
  insertAuditRecord,
  insertAuthorSession,
  type AuthorSessionRecord,
} from "@/db/auth-repository";
import type { Clock } from "@/domain/clock";
import { hashPassword, verifyPassword } from "@/security/password-hash";
import { createTestHarness, type TestHarness } from "@/test/harness";
import {
  clearLoginFailures,
  createAuthorAuthContext,
  loginAuthor,
  revokeAllAuthorSessions,
  verifyAuthorSession,
  type AuthorAuthContext,
  type TotpVerifier,
} from "./auth";

// PHC of "author-password" generated once with hashPassword (Argon2id, m=19456, t=2, p=1).
const TEST_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$BGLpLUMVsi0HJfyI9MB0sQ$sUEMHWUd6enbdKr2r+eBTBFLxbnaq+N9BtI7/bvsuhk";
const CORRECT_PASSWORD = "author-password";
const START = "2025-06-15T08:30:00.000Z";
const DAY_MS = 24 * 60 * 60 * 1000;

interface ManualClock extends Clock {
  advance(ms: number): void;
}

function manualClock(startIso: string): ManualClock {
  let current = new Date(startIso);
  return {
    now: () => new Date(current),
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

interface Row {
  [column: string]: unknown;
}

describe("author auth service", () => {
  let harness: TestHarness;
  let clock: ManualClock;

  beforeEach(async () => {
    harness = await createTestHarness();
    clock = manualClock(START);
  });

  afterEach(async () => {
    await harness.close();
  });

  function context(overrides: Partial<AuthorAuthContext> = {}): AuthorAuthContext {
    return {
      ...createAuthorAuthContext(
        harness.database,
        clock,
        resolveAuthConfig({ NODE_ENV: "test" }),
      ),
      passwordHash: TEST_PASSWORD_HASH,
      ...overrides,
    };
  }

  function login(
    ctx: AuthorAuthContext,
    overrides: Partial<{ password: string; totpCode: string; source: string | null; userAgent: string | null }> = {},
  ) {
    return loginAuthor(ctx, {
      password: CORRECT_PASSWORD,
      source: "127.0.0.1",
      userAgent: "test-agent",
      ...overrides,
    });
  }

  function rows(table: "session" | "auth_audit_log"): Row[] {
    return harness.database.sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Row[];
  }

  it("stores a fresh session row on successful login", async () => {
    const ctx = context();
    const outcome = await login(ctx);
    const expectedExpiry = new Date(new Date(START).getTime() + 30 * DAY_MS);

    expect(outcome).toEqual({
      ok: true,
      sessionId: expect.any(String),
      expiresAt: expectedExpiry,
    });
    if (!outcome.ok) {
      return;
    }

    const stored = rows("session");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: outcome.sessionId,
      created_at: START,
      last_seen_at: START,
      expires_at: expectedExpiry.toISOString(),
    });
    expect(outcome.sessionId).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("rejects a wrong password and leaves an audit trace", async () => {
    const outcome = await login(context(), { password: "not-the-password", userAgent: "curl/8" });

    expect(outcome).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(rows("session")).toEqual([]);

    const audit = rows("auth_audit_log");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      occurred_at: START,
      kind: "login-failed",
      source: "127.0.0.1",
      detail: "curl/8",
    });
  });

  it("escalates the per-source backoff across consecutive failures", async () => {
    const ctx = context();
    const wrong = { password: "not-the-password" };

    expect(await login(ctx, wrong)).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(await login(ctx, wrong)).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(await login(ctx, wrong)).toEqual({ ok: false, reason: "invalid-credentials" });

    expect(await login(ctx, wrong)).toEqual({
      ok: false,
      reason: "rate-limited",
      retryAfterSeconds: 30,
    });
    expect(await login(ctx, wrong)).toEqual({
      ok: false,
      reason: "rate-limited",
      retryAfterSeconds: 30,
    });

    clock.advance(30_000);
    expect(await login(ctx, wrong)).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(await login(ctx, wrong)).toEqual({
      ok: false,
      reason: "rate-limited",
      retryAfterSeconds: 60,
    });

    clock.advance(60_000);
    expect(await login(ctx, wrong)).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(await login(ctx, wrong)).toEqual({
      ok: false,
      reason: "rate-limited",
      retryAfterSeconds: 120,
    });

    const rateLimitAudits = rows("auth_audit_log").filter(
      (row) => row.kind === "login-rate-limited",
    );
    expect(rateLimitAudits).toHaveLength(4);
    for (const row of rateLimitAudits) {
      expect(row.detail).toBe("per-source");
      expect(row.source).toBe("127.0.0.1");
    }
    expect(rows("auth_audit_log").filter((row) => row.kind === "login-failed")).toHaveLength(5);
  });

  it("caps the per-source backoff at the configured maximum", async () => {
    const ctx = context({
      throttle: {
        windowMs: 15 * 60_000,
        failureThreshold: 3,
        backoffBaseMs: 30_000,
        backoffCapMs: 90_000,
        globalWindowMs: 10 * 60_000,
        globalFailureThreshold: 20,
        globalBackoffBaseMs: 5 * 60_000,
        globalBackoffCapMs: 60 * 60_000,
      },
    });
    const wrong = { password: "not-the-password" };

    await login(ctx, wrong);
    await login(ctx, wrong);
    await login(ctx, wrong);
    expect(await login(ctx, wrong)).toMatchObject({ reason: "rate-limited", retryAfterSeconds: 30 });

    clock.advance(30_000);
    await login(ctx, wrong);
    expect(await login(ctx, wrong)).toMatchObject({ reason: "rate-limited", retryAfterSeconds: 60 });

    clock.advance(60_000);
    await login(ctx, wrong);
    expect(await login(ctx, wrong)).toMatchObject({
      reason: "rate-limited",
      retryAfterSeconds: 90,
    });
  });

  it("recovers once every failure has left the window", async () => {
    const ctx = context();
    const wrong = { password: "not-the-password" };

    await login(ctx, wrong);
    await login(ctx, wrong);
    await login(ctx, wrong);
    expect(await login(ctx, wrong)).toMatchObject({ reason: "rate-limited" });

    clock.advance(15 * 60_000 + 1);
    expect(await login(ctx, wrong)).toEqual({ ok: false, reason: "invalid-credentials" });
  });

  it("throttles globally once many distinct sources fail", async () => {
    const ctx = context({
      throttle: {
        windowMs: 15 * 60_000,
        failureThreshold: 3,
        backoffBaseMs: 30_000,
        backoffCapMs: 30 * 60_000,
        globalWindowMs: 10 * 60_000,
        globalFailureThreshold: 2,
        globalBackoffBaseMs: 60_000,
        globalBackoffCapMs: 60 * 60_000,
      },
    });
    const wrong = { password: "not-the-password" };

    expect(await login(ctx, { ...wrong, source: "10.0.0.1" })).toEqual({
      ok: false,
      reason: "invalid-credentials",
    });
    expect(await login(ctx, { ...wrong, source: "10.0.0.2" })).toEqual({
      ok: false,
      reason: "invalid-credentials",
    });
    expect(await login(ctx, { ...wrong, source: "10.0.0.3" })).toEqual({
      ok: false,
      reason: "rate-limited",
      retryAfterSeconds: 60,
    });

    const globalAudit = rows("auth_audit_log").filter(
      (row) => row.kind === "login-rate-limited",
    );
    expect(globalAudit).toHaveLength(1);
    expect(globalAudit[0]).toMatchObject({ detail: "global", source: "10.0.0.3" });
  });

  it("fails every attempt when no password hash is configured", async () => {
    const ctx = context({ passwordHash: null });

    expect(await login(ctx)).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(await login(ctx, { password: CORRECT_PASSWORD })).toEqual({
      ok: false,
      reason: "invalid-credentials",
    });
    expect(rows("session")).toEqual([]);

    const audit = rows("auth_audit_log");
    expect(audit).toHaveLength(2);
    for (const row of audit) {
      expect(row).toMatchObject({ kind: "login-failed", detail: "password-hash-unset" });
    }
  });

  it("rolls the session expiry forward on each verification", () => {
    const ctx = context();
    insertAuthorSession(harness.database.db, {
      id: "session-1",
      createdAt: clock.now(),
      lastSeenAt: clock.now(),
      expiresAt: new Date(clock.now().getTime() + 30 * DAY_MS),
    });

    clock.advance(5 * 60_000);
    const verified = verifyAuthorSession(ctx, "session-1");
    const expectedLastSeen = new Date("2025-06-15T08:35:00.000Z");
    const expectedExpiry = new Date(expectedLastSeen.getTime() + 30 * DAY_MS);

    expect(verified).toEqual({
      id: "session-1",
      createdAt: new Date(START),
      lastSeenAt: expectedLastSeen,
      expiresAt: expectedExpiry,
    });
    const stored = rows("session")[0];
    expect(stored).toMatchObject({
      id: "session-1",
      created_at: START,
      last_seen_at: "2025-06-15T08:35:00.000Z",
      expires_at: expectedExpiry.toISOString(),
    });
  });

  it("deletes expired sessions on verification and rejects unknown ids", () => {
    const ctx = context();
    const expired: AuthorSessionRecord = {
      id: "expired-session",
      createdAt: clock.now(),
      lastSeenAt: clock.now(),
      expiresAt: new Date(clock.now().getTime() - 1),
    };
    insertAuthorSession(harness.database.db, expired);

    expect(verifyAuthorSession(ctx, "expired-session")).toBeNull();
    expect(rows("session")).toEqual([]);
    expect(verifyAuthorSession(ctx, "unknown-session")).toBeNull();
  });

  it("revokes every session and reports the removed count", () => {
    const ctx = context();
    const seed = (id: string): AuthorSessionRecord => ({
      id,
      createdAt: clock.now(),
      lastSeenAt: clock.now(),
      expiresAt: new Date(clock.now().getTime() + 30 * DAY_MS),
    });
    insertAuthorSession(harness.database.db, seed("session-1"));
    insertAuthorSession(harness.database.db, seed("session-2"));

    expect(revokeAllAuthorSessions(ctx)).toBe(2);
    expect(rows("session")).toEqual([]);
  });

  it("clears both audit kinds and reports the removed count", () => {
    const ctx = context();
    const at = clock.now();
    for (let i = 0; i < 3; i += 1) {
      insertAuditRecord(harness.database.db, {
        occurredAt: at,
        kind: "login-failed",
        source: "10.0.0.1",
        detail: null,
      });
    }
    for (let i = 0; i < 2; i += 1) {
      insertAuditRecord(harness.database.db, {
        occurredAt: at,
        kind: "login-rate-limited",
        source: "10.0.0.1",
        detail: "per-source",
      });
    }

    expect(clearLoginFailures(ctx)).toBe(5);
    expect(rows("auth_audit_log")).toEqual([]);
  });

  describe("TOTP hook", () => {
    function totpContext(verifier: TotpVerifier): AuthorAuthContext {
      return context({ totpVerifier: verifier });
    }

    function recordingVerifier(): TotpVerifier & { codes: string[] } {
      const codes: string[] = [];
      return {
        codes,
        async verify(code: string) {
          codes.push(code);
          return code === "123456";
        },
      };
    }

    it("rejects a correct password without a valid TOTP code and audits it", async () => {
      const verifier = recordingVerifier();
      const ctx = totpContext(verifier);

      expect(await login(ctx)).toEqual({ ok: false, reason: "invalid-credentials" });
      expect(await login(ctx, { totpCode: "000000" })).toEqual({
        ok: false,
        reason: "invalid-credentials",
      });
      expect(rows("session")).toEqual([]);

      const audit = rows("auth_audit_log");
      expect(audit).toHaveLength(2);
      for (const row of audit) {
        expect(row).toMatchObject({ kind: "login-failed", detail: "totp-mismatch" });
      }
      expect(verifier.codes).toEqual(["000000"]);
    });

    it("accepts a correct password with a valid TOTP code", async () => {
      const ctx = totpContext(recordingVerifier());
      expect(await login(ctx, { totpCode: "123456" })).toMatchObject({ ok: true });
      expect(rows("session")).toHaveLength(1);
    });

    it("checks the password before the TOTP code", async () => {
      const verifier = recordingVerifier();
      const ctx = totpContext(verifier);

      expect(await login(ctx, { password: "not-the-password", totpCode: "123456" })).toEqual({
        ok: false,
        reason: "invalid-credentials",
      });
      expect(verifier.codes).toEqual([]);
      expect(rows("auth_audit_log")[0]).toMatchObject({
        kind: "login-failed",
        detail: "test-agent",
      });
    });

    it("ignores totpCode while no verifier is configured", async () => {
      expect(await login(context(), { totpCode: "000000" })).toMatchObject({ ok: true });
    });
  });
});

describe("password hashing", () => {
  it("round-trips through hashPassword and verifyPassword", async () => {
    const encoded = await hashPassword(CORRECT_PASSWORD);

    expect(await verifyPassword(encoded, CORRECT_PASSWORD)).toBe(true);
    expect(await verifyPassword(encoded, "not-the-password")).toBe(false);
  });

  it("fails closed on malformed hashes", async () => {
    expect(await verifyPassword("not-a-phc-hash", CORRECT_PASSWORD)).toBe(false);
    expect(await verifyPassword("", CORRECT_PASSWORD)).toBe(false);
  });

  it("accepts the embedded test hash for the documented plaintext", async () => {
    expect(await verifyPassword(TEST_PASSWORD_HASH, CORRECT_PASSWORD)).toBe(true);
  });
});
