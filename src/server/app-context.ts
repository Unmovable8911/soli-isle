import { resolveRuntimePaths } from "@/config/runtime";
import { openDatabase, type DatabaseConnection } from "@/db/database";
import { createDatabaseAvailabilityProbe } from "@/db/database-health";
import { runMigrations } from "@/db/migrate";
import { systemClock, type Clock } from "@/domain/clock";
import type { HealthContext } from "@/services/health";
import { FileSystemResourceStorage } from "@/storage/filesystem-resource-storage";

export interface AppContext {
  database: DatabaseConnection;
  clock: Clock;
  storage: FileSystemResourceStorage;
  health: HealthContext;
}

let cachedContext: AppContext | undefined;

export function createAppContext(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): AppContext {
  const paths = resolveRuntimePaths(env, cwd);
  const database = openDatabase(paths.databasePath);

  try {
    runMigrations(database.db, paths.migrationsDir);
  } catch (error) {
    database.sqlite.close();
    throw error;
  }

  const storage = new FileSystemResourceStorage(paths.resourceDir);

  return {
    database,
    clock: systemClock,
    storage,
    health: {
      database: createDatabaseAvailabilityProbe(database.sqlite, paths.databasePath),
      storage,
    },
  };
}

export function getAppContext(): AppContext {
  cachedContext ??= createAppContext();
  return cachedContext;
}
