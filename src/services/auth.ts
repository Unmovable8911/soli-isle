import { randomBytes } from "node:crypto";
import {
  clearLoginFailureRecords,
  deleteAllAuthorSessions,
  deleteAuthorSession,
  findAuthorSession,
  insertAuditRecord,
  insertAuthorSession,
  recentLoginFailures,
  updateAuthorSession,
} from "@/db/auth-repository";
import type { AuthorAuthConfig } from "@/config/auth";
import type { DatabaseConnection } from "@/db/database";
import type { Clock } from "@/domain/clock";
import { loginRetryDelay, type ThrottleConfig } from "@/domain/throttle";
import { verifyPassword } from "@/security/password-hash";

const DAY_MS = 24 * 60 * 60 * 1000;

// Argon2id PHC of an unreachable plaintext, verified when no password hash is
// configured so the unset path costs the same as a real verification.
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$XBOtFz9T1IpXkqtpQjEf9A$hJq2UNZ5UVyZpZNpBNUWQhk+xb3yiU41M+X9wSvioyA";

export interface TotpVerifier {
  verify(code: string): Promise<boolean>;
}

export interface AuthorAuthContext {
  database: DatabaseConnection;
  clock: Clock;
  passwordHash: string | null;
  totpVerifier: TotpVerifier | null;
  throttle: ThrottleConfig;
  sessionTtlDays: number;
}

export function createAuthorAuthContext(
  database: DatabaseConnection,
  clock: Clock,
  config: AuthorAuthConfig,
  totpVerifier: TotpVerifier | null = null,
): AuthorAuthContext {
  return {
    database,
    clock,
    passwordHash: config.passwordHash,
    totpVerifier,
    throttle: config.throttle,
    sessionTtlDays: config.sessionTtlDays,
  };
}

export type LoginOutcome =
  | { ok: true; sessionId: string; expiresAt: Date }
  | { ok: false; reason: "invalid-credentials" | "rate-limited"; retryAfterSeconds?: number };

export async function loginAuthor(
  ctx: AuthorAuthContext,
  input: { password: string; totpCode?: string; source: string | null; userAgent: string | null },
): Promise<LoginOutcome> {
  const now = ctx.clock.now();
  const db = ctx.database.db;

  const perSourceFailures = recentLoginFailures(
    db,
    input.source,
    new Date(now.getTime() - ctx.throttle.windowMs),
  );
  const globalFailures = recentLoginFailures(
    db,
    null,
    new Date(now.getTime() - ctx.throttle.globalWindowMs),
  );

  const perSourceDelay = loginRetryDelay(
    perSourceFailures,
    now,
    ctx.throttle.windowMs,
    ctx.throttle.failureThreshold,
    ctx.throttle.backoffBaseMs,
    ctx.throttle.backoffCapMs,
  );
  const globalDelay = loginRetryDelay(
    globalFailures,
    now,
    ctx.throttle.globalWindowMs,
    ctx.throttle.globalFailureThreshold,
    ctx.throttle.globalBackoffBaseMs,
    ctx.throttle.globalBackoffCapMs,
  );

  const blockingDelay = Math.max(perSourceDelay ?? 0, globalDelay ?? 0);
  if (blockingDelay > 0) {
    insertAuditRecord(db, {
      occurredAt: now,
      kind: "login-rate-limited",
      source: input.source,
      detail: (globalDelay ?? -1) > (perSourceDelay ?? -1) ? "global" : "per-source",
    });
    return {
      ok: false,
      reason: "rate-limited",
      retryAfterSeconds: Math.ceil(blockingDelay / 1000),
    };
  }

  const passwordOk = await verifyPassword(ctx.passwordHash ?? DUMMY_PASSWORD_HASH, input.password);
  if (!passwordOk || ctx.passwordHash === null) {
    insertAuditRecord(db, {
      occurredAt: now,
      kind: "login-failed",
      source: input.source,
      detail: ctx.passwordHash === null ? "password-hash-unset" : input.userAgent,
    });
    return { ok: false, reason: "invalid-credentials" };
  }

  if (ctx.totpVerifier !== null) {
    const totpOk =
      input.totpCode !== undefined && (await ctx.totpVerifier.verify(input.totpCode));
    if (!totpOk) {
      insertAuditRecord(db, {
        occurredAt: now,
        kind: "login-failed",
        source: input.source,
        detail: "totp-mismatch",
      });
      return { ok: false, reason: "invalid-credentials" };
    }
  }

  const sessionId = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + ctx.sessionTtlDays * DAY_MS);
  insertAuthorSession(db, {
    id: sessionId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
  });
  return { ok: true, sessionId, expiresAt };
}

export interface VerifiedAuthorSession {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

export function verifyAuthorSession(
  ctx: AuthorAuthContext,
  sessionId: string,
): VerifiedAuthorSession | null {
  const db = ctx.database.db;
  const now = ctx.clock.now();

  const record = findAuthorSession(db, sessionId);
  if (record === null) {
    return null;
  }

  if (record.expiresAt.getTime() <= now.getTime()) {
    deleteAuthorSession(db, sessionId);
    return null;
  }

  const lastSeenAt = now;
  const expiresAt = new Date(now.getTime() + ctx.sessionTtlDays * DAY_MS);
  updateAuthorSession(db, sessionId, lastSeenAt, expiresAt);
  return {
    id: record.id,
    createdAt: record.createdAt,
    lastSeenAt,
    expiresAt,
  };
}

export function revokeAllAuthorSessions(ctx: AuthorAuthContext): number {
  return deleteAllAuthorSessions(ctx.database.db);
}

export function clearLoginFailures(ctx: AuthorAuthContext): number {
  return clearLoginFailureRecords(ctx.database.db);
}
