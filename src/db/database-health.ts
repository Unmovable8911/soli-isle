import type Database from "better-sqlite3";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import type { AvailabilityProbe } from "@/services/health";

export function createDatabaseAvailabilityProbe(
  sqlite: Database.Database,
  databasePath: string,
): AvailabilityProbe {
  return {
    async checkAvailability() {
      if (databasePath !== ":memory:") {
        await access(databasePath, constants.R_OK | constants.W_OK);
      }

      const result = sqlite
        .prepare("UPDATE health_check SET touched_at = ? WHERE id = 1")
        .run(new Date().toISOString());
      if (result.changes !== 1) {
        throw new Error("Database health probe did not update its row");
      }

      sqlite.prepare("SELECT 1").get();
    },
  };
}
