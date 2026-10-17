import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDatabase, type AppDatabase, type DatabaseConnection } from "@/db/database";
import { runMigrations } from "@/db/migrate";
import { fixedClock, type Clock } from "@/domain/clock";
import { FileSystemResourceStorage } from "@/storage/filesystem-resource-storage";

const DEFAULT_FIXED_INSTANT = new Date("2025-06-15T08:30:00.000Z");

export interface TestHarness {
  database: DatabaseConnection;
  clock: Clock;
  resources: {
    rootDir: string;
    storage: FileSystemResourceStorage;
  };
  migrationsDir: string;
  close(): Promise<void>;
}

export interface TestHarnessOptions {
  now?: Date;
  migrationsDir?: string;
  seed?: (database: AppDatabase) => void | Promise<void>;
}

export async function createTestHarness(options: TestHarnessOptions = {}): Promise<TestHarness> {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "soli-isle-test-"));
  const migrationsDir = options.migrationsDir ?? path.resolve(process.cwd(), "drizzle");
  const database = openDatabase(":memory:");
  const rootDir = path.join(temporaryRoot, "resources");

  try {
    runMigrations(database.db, migrationsDir);
    await options.seed?.(database.db);
  } catch (error) {
    database.sqlite.close();
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }

  return {
    database,
    clock: fixedClock(options.now ?? DEFAULT_FIXED_INSTANT),
    resources: {
      rootDir,
      storage: new FileSystemResourceStorage(rootDir),
    },
    migrationsDir,
    async close() {
      if (database.sqlite.open) {
        database.sqlite.close();
      }
      await rm(temporaryRoot, { recursive: true, force: true });
    },
  };
}
