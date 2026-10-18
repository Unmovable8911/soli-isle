import { readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabaseAvailabilityProbe } from "@/db/database-health";
import { runMigrations } from "@/db/migrate";
import { getHealth } from "@/services/health";
import { FileSystemResourceStorage } from "@/storage/filesystem-resource-storage";
import { createTestHarness, type TestHarness } from "./harness";

describe("shared test harness", () => {
  let harness: TestHarness | undefined;

  afterEach(async () => {
    await harness?.close();
    harness = undefined;
  });

  it("starts with the complete application schema produced by a fresh migration run", async () => {
    harness = await createTestHarness();

    const tables = readApplicationSchema(harness)
      .filter((row) => row.type === "table")
      .map((row) => row.name);

    expect(tables).toEqual([
      "asset",
      "asset_reference",
      "asset_variant",
      "auth_audit_log",
      "health_check",
      "session",
    ]);
    expect(columnsOf(harness, "health_check")).toEqual(["id", "touched_at"]);
    expect(columnsOf(harness, "session")).toEqual(["id", "created_at", "last_seen_at", "expires_at"]);
    expect(columnsOf(harness, "auth_audit_log")).toEqual([
      "id",
      "occurred_at",
      "kind",
      "source",
      "detail",
    ]);
    expect(columnsOf(harness, "asset")).toEqual([
      "id",
      "file_name",
      "mime_type",
      "byte_size",
      "width",
      "height",
      "content_hash",
      "uploaded_at",
    ]);
    expect(columnsOf(harness, "asset_variant")).toEqual([
      "asset_id",
      "variant",
      "byte_size",
      "width",
      "height",
      "format",
    ]);
    expect(columnsOf(harness, "asset_reference")).toEqual([
      "id",
      "asset_id",
      "content_kind",
      "content_id",
    ]);
  });

  it("can re-run migrations without changing the established schema", async () => {
    const activeHarness = await createTestHarness();
    harness = activeHarness;
    const schemaBefore = readApplicationSchema(activeHarness);

    expect(() =>
      runMigrations(activeHarness.database.db, activeHarness.migrationsDir),
    ).not.toThrow();

    expect(readApplicationSchema(activeHarness)).toEqual(schemaBefore);
  });

  it("provides a fixed clock and a clean temporary resource directory", async () => {
    harness = await createTestHarness();

    expect(harness.clock.now().toISOString()).toBe("2025-06-15T08:30:00.000Z");
    const changed = harness.clock.now();
    changed.setUTCFullYear(2030);
    expect(harness.clock.now().toISOString()).toBe("2025-06-15T08:30:00.000Z");

    await harness.resources.storage.checkAvailability();
    await expect(readdir(harness.resources.rootDir)).resolves.toEqual([]);
    expect(path.relative(tmpdir(), harness.resources.rootDir).startsWith("..")).toBe(false);
  });

  it("wires real database and storage availability into health checks", async () => {
    harness = await createTestHarness();

    await expect(
      getHealth({
        database: createDatabaseAvailabilityProbe(harness.database.sqlite, ":memory:"),
        storage: harness.resources.storage,
      }),
    ).resolves.toEqual({
      status: "ok",
      checks: { database: "ok", storage: "ok" },
    });

    harness.database.sqlite.close();
    await expect(
      getHealth({
        database: createDatabaseAvailabilityProbe(harness.database.sqlite, ":memory:"),
        storage: harness.resources.storage,
      }),
    ).resolves.toEqual({
      status: "degraded",
      checks: { database: "unavailable", storage: "ok" },
    });
  });

  it("fails its availability check when the resource directory cannot be used", async () => {
    harness = await createTestHarness();
    const blockingFile = path.join(path.dirname(harness.resources.rootDir), "not-a-directory");
    await writeFile(blockingFile, "blocked");

    const storage = new FileSystemResourceStorage(blockingFile);
    await expect(storage.checkAvailability()).rejects.toThrow();

    await rm(blockingFile, { force: true });
  });
});

interface SchemaRow {
  type: string;
  name: string;
  sql: string | null;
}

function readApplicationSchema(harness: TestHarness): SchemaRow[] {
  return harness.database.sqlite
    .prepare(
      "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name <> '__drizzle_migrations' ORDER BY type, name",
    )
    .all() as SchemaRow[];
}

function columnsOf(harness: TestHarness, table: string): string[] {
  return (
    harness.database.sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  ).map((column) => column.name);
}
