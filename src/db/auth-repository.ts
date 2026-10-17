import { and, asc, eq, gt, inArray } from "drizzle-orm";
import type { AppDatabase } from "@/db/database";
import { authAuditLog, session } from "@/db/schema";

export interface AuthorSessionRecord {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

export function insertAuthorSession(db: AppDatabase, record: AuthorSessionRecord): void {
  db.insert(session)
    .values({
      id: record.id,
      createdAt: record.createdAt.toISOString(),
      lastSeenAt: record.lastSeenAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
    })
    .run();
}

export function findAuthorSession(db: AppDatabase, id: string): AuthorSessionRecord | null {
  const row = db.select().from(session).where(eq(session.id, id)).get();
  if (row === undefined) {
    return null;
  }

  return {
    id: row.id,
    createdAt: new Date(row.createdAt),
    lastSeenAt: new Date(row.lastSeenAt),
    expiresAt: new Date(row.expiresAt),
  };
}

export function updateAuthorSession(
  db: AppDatabase,
  id: string,
  lastSeenAt: Date,
  expiresAt: Date,
): void {
  db.update(session)
    .set({
      lastSeenAt: lastSeenAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
    .where(eq(session.id, id))
    .run();
}

export function deleteAuthorSession(db: AppDatabase, id: string): void {
  db.delete(session).where(eq(session.id, id)).run();
}

export function deleteAllAuthorSessions(db: AppDatabase): number {
  return db.delete(session).run().changes;
}

export interface AuditRecord {
  occurredAt: Date;
  kind: "login-failed" | "login-rate-limited";
  source: string | null;
  detail: string | null;
}

export function insertAuditRecord(db: AppDatabase, record: AuditRecord): void {
  db.insert(authAuditLog)
    .values({
      occurredAt: record.occurredAt.toISOString(),
      kind: record.kind,
      source: record.source,
      detail: record.detail,
    })
    .run();
}

export function recentLoginFailures(db: AppDatabase, source: string | null, since: Date): Date[] {
  const conditions = [
    eq(authAuditLog.kind, "login-failed"),
    gt(authAuditLog.occurredAt, since.toISOString()),
  ];
  if (source !== null) {
    conditions.push(eq(authAuditLog.source, source));
  }

  const rows = db
    .select({ occurredAt: authAuditLog.occurredAt })
    .from(authAuditLog)
    .where(and(...conditions))
    .orderBy(asc(authAuditLog.occurredAt))
    .all();

  return rows.map((row) => new Date(row.occurredAt));
}

export function clearLoginFailureRecords(db: AppDatabase): number {
  return db
    .delete(authAuditLog)
    .where(inArray(authAuditLog.kind, ["login-failed", "login-rate-limited"]))
    .run().changes;
}
