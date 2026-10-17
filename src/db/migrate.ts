import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { AppDatabase } from "./database";

export function runMigrations(db: AppDatabase, migrationsDir: string): void {
  migrate(db, { migrationsFolder: migrationsDir });
}
