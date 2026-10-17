import path from "node:path";

export interface RuntimePaths {
  databasePath: string;
  resourceDir: string;
  migrationsDir: string;
}

const DEFAULT_DATABASE_PATH = "data/database/soli-isle.sqlite";
const DEFAULT_RESOURCE_DIR = "data/images";
const DEFAULT_MIGRATIONS_DIR = "drizzle";

function resolveConfiguredPath(value: string | undefined, fallback: string, cwd: string): string {
  const configured = value?.trim() || fallback;
  return configured === ":memory:" ? configured : path.resolve(cwd, configured);
}

export function resolveRuntimePaths(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): RuntimePaths {
  return {
    databasePath: resolveConfiguredPath(env.DATABASE_PATH, DEFAULT_DATABASE_PATH, cwd),
    resourceDir: resolveConfiguredPath(env.RESOURCE_DIR, DEFAULT_RESOURCE_DIR, cwd),
    migrationsDir: path.resolve(cwd, DEFAULT_MIGRATIONS_DIR),
  };
}
