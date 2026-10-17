import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveAuthConfig } from "@/config/auth";
import { openDatabase, type DatabaseConnection } from "@/db/database";
import { runMigrations } from "@/db/migrate";
import type { Clock } from "@/domain/clock";
import type { AuthorAuthContext } from "@/services/auth";
import { loginResponse, logoutResponse } from "./admin-auth";

const TEST_PASSWORD = "correct horse battery staple";
// Generated once with hashPassword(TEST_PASSWORD) (argon2id, m=19456, t=2, p=1).
const TEST_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$WO0h9f3eQV9vfk1e2CyvGA$hQVmvUfeUwYAV/xvu8PT32xbZipFsFdwbIIwK5PMXuI";

interface AdvancingClock extends Clock {
  advance(milliseconds: number): void;
}

describe("admin auth HTTP adapter", () => {
  const temporaryRoots: string[] = [];
  const databases: DatabaseConnection[] = [];

  afterEach(async () => {
    for (const database of databases.splice(0)) {
      if (database.sqlite.open) {
        database.sqlite.close();
      }
    }
    await Promise.all(
      temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  it("logs in over http and sets the session cookie without Secure", async () => {
    const { auth, database } = await createFileContext();
    const response = await loginResponse(auth, loginRequest(TEST_PASSWORD));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/admin");
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toMatch(/soli-session=[^;]+/);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
    expect(countSessions(database)).toBe(1);
  });

  it("adds Secure when the login request was forwarded over https", async () => {
    const { auth } = await createFileContext();
    const response = await loginResponse(auth, loginRequest(TEST_PASSWORD, "https"));

    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("redirects to the invalid error page and audits a wrong password", async () => {
    const { auth, database } = await createFileContext();
    const response = await loginResponse(auth, loginRequest("wrong password"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/admin/login?error=invalid");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(countAudit(database, "login-failed")).toBe(1);
    expect(countSessions(database)).toBe(0);
  });

  it("rate-limits from the fourth consecutive failure with Retry-After", async () => {
    const { auth } = await createFileContext();
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await loginResponse(auth, loginRequest("wrong password"));
      expect(response.headers.get("location")).toBe("http://localhost/admin/login?error=invalid");
    }

    const limited = await loginResponse(auth, loginRequest("wrong password"));
    expect(limited.status).toBe(303);
    expect(limited.headers.get("location")).toBe(
      "http://localhost/admin/login?error=rate-limited",
    );
    const retryAfter = Number(limited.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(0);
  });

  it("rejects logout without a session cookie", async () => {
    const { auth } = await createFileContext();
    const response = await logoutResponse(auth, logoutRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("rejects logout with an unknown session id", async () => {
    const { auth } = await createFileContext();
    const response = await logoutResponse(auth, logoutRequest("soli-session=does-not-exist"));

    expect(response.status).toBe(401);
  });

  it("logs a valid session out, revokes all sessions and clears the cookie", async () => {
    const { auth, database } = await createFileContext();
    const login = await loginResponse(auth, loginRequest(TEST_PASSWORD));
    expect(login.status).toBe(303);
    expect(countSessions(database)).toBe(1);

    const response = await logoutResponse(auth, logoutRequest(login.headers.get("set-cookie")));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/admin/login");
    expect(countSessions(database)).toBe(0);
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("soli-session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  async function createFileContext() {
    const rootDir = await mkdtemp(path.join(tmpdir(), "soli-isle-admin-auth-"));
    temporaryRoots.push(rootDir);
    const databasePath = path.join(rootDir, "site.sqlite");
    const database = openDatabase(databasePath);
    databases.push(database);
    runMigrations(database.db, path.resolve(process.cwd(), "drizzle"));
    const clock = advancingClock();
    const config = resolveAuthConfig({ NODE_ENV: "test" });
    const auth: AuthorAuthContext = {
      database,
      clock,
      passwordHash: TEST_PASSWORD_HASH,
      sessionTtlDays: config.sessionTtlDays,
      totpVerifier: null,
      throttle: config.throttle,
    };

    return { auth, database, clock, rootDir };
  }
});

function loginRequest(password: string, forwardedProtocol = "http"): Request {
  const headers = new Headers({
    "content-type": "application/x-www-form-urlencoded",
    "x-forwarded-proto": forwardedProtocol,
    "x-forwarded-for": "203.0.113.7",
  });
  return new Request("http://localhost/admin/login/submit", {
    method: "POST",
    headers,
    body: new URLSearchParams({ password }),
  });
}

function logoutRequest(cookieHeader?: string | null): Request {
  return new Request("http://localhost/admin/logout", {
    method: "POST",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
}

function advancingClock(start = new Date("2025-06-01T00:00:00.000Z")): AdvancingClock {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance: (milliseconds) => {
      current += milliseconds;
    },
  };
}

function countSessions(database: DatabaseConnection): number {
  const row = database.sqlite.prepare("SELECT COUNT(*) AS n FROM session").get() as {
    n: number;
  };
  return row.n;
}

function countAudit(database: DatabaseConnection, kind: string): number {
  const row = database.sqlite
    .prepare("SELECT COUNT(*) AS n FROM auth_audit_log WHERE kind = ?")
    .get(kind) as { n: number };
  return row.n;
}
