import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listRecentArticles } from "@/services/reading";
import { createAppContext } from "./app-context";

describe("application startup context", () => {
  const temporaryRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  it("creates and migrates a fresh database before handing out services", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "soli-isle-startup-"));
    temporaryRoots.push(temporaryRoot);
    const databasePath = path.join(temporaryRoot, "database", "site.sqlite");
    const resourceDir = path.join(temporaryRoot, "images");

    const context = createAppContext(
      {
        NODE_ENV: "test",
        DATABASE_PATH: databasePath,
        RESOURCE_DIR: resourceDir,
      },
      process.cwd(),
    );

    try {
      await expect(context.health.database.checkAvailability()).resolves.toBeUndefined();
      await expect(context.health.storage.checkAvailability()).resolves.toBeUndefined();
    } finally {
      context.database.sqlite.close();
    }
  });

  it("hands out the Reader service as part of the injected context", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "soli-isle-startup-"));
    temporaryRoots.push(temporaryRoot);
    const context = createAppContext(
      {
        NODE_ENV: "test",
        DATABASE_PATH: path.join(temporaryRoot, "database", "site.sqlite"),
        RESOURCE_DIR: path.join(temporaryRoot, "images"),
      },
      process.cwd(),
    );

    try {
      await expect(listRecentArticles(context.reading, { locale: "zh" })).resolves.toEqual([]);
    } finally {
      context.database.sqlite.close();
    }
  });

  it("reports the database unavailable when its file disappears", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "soli-isle-startup-"));
    temporaryRoots.push(temporaryRoot);
    const databasePath = path.join(temporaryRoot, "database", "site.sqlite");
    const context = createAppContext(
      {
        NODE_ENV: "test",
        DATABASE_PATH: databasePath,
        RESOURCE_DIR: path.join(temporaryRoot, "images"),
      },
      process.cwd(),
    );

    try {
      await rm(databasePath);
      await expect(context.health.database.checkAvailability()).rejects.toThrow();
    } finally {
      context.database.sqlite.close();
    }
  });
});
