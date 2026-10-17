import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase, type DatabaseConnection } from "@/db/database";
import { createDatabaseAvailabilityProbe } from "@/db/database-health";
import { runMigrations } from "@/db/migrate";
import { FileSystemResourceStorage } from "@/storage/filesystem-resource-storage";
import { healthResponse } from "./health";

describe("health endpoint adapter", () => {
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

  it("returns 200 against a real file database and writable resource directory", async () => {
    const { database, databasePath, storage } = await createFileContext();
    const response = await healthResponse({
      database: createDatabaseAvailabilityProbe(database.sqlite, databasePath),
      storage,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      checks: { database: "ok", storage: "ok" },
    });
  });

  it("returns 503 when resource storage cannot be written", async () => {
    const { database, databasePath, rootDir } = await createFileContext();
    const blockedPath = path.join(rootDir, "blocked");
    await writeFile(blockedPath, "not a directory");
    const response = await healthResponse({
      database: createDatabaseAvailabilityProbe(database.sqlite, databasePath),
      storage: new FileSystemResourceStorage(blockedPath),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "degraded",
      checks: { database: "ok", storage: "unavailable" },
    });
  });

  async function createFileContext() {
    const rootDir = await mkdtemp(path.join(tmpdir(), "soli-isle-health-"));
    temporaryRoots.push(rootDir);
    const databasePath = path.join(rootDir, "site.sqlite");
    const database = openDatabase(databasePath);
    databases.push(database);
    runMigrations(database.db, path.resolve(process.cwd(), "drizzle"));
    const storage = new FileSystemResourceStorage(path.join(rootDir, "images"));

    return { database, databasePath, rootDir, storage };
  }
});
