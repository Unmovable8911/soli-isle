import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export interface DatabaseConnection {
  sqlite: Database.Database;
  db: AppDatabase;
}

export type AppDatabase = ReturnType<typeof createAppDatabase>;

function createAppDatabase(sqlite: Database.Database) {
  return drizzle(sqlite, { schema });
}

export function openDatabase(databasePath: string): DatabaseConnection {
  if (databasePath !== ":memory:") {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return {
    sqlite,
    db: createAppDatabase(sqlite),
  };
}
