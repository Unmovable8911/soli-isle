import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createTestHarness } from "@/test/harness";

interface ColumnInfo {
  name: string;
  notnull: number;
  dflt_value: string | null;
}

interface ForeignKeyInfo {
  table: string;
  from: string;
  on_delete: string;
}

/**
 * The migration chain has to build the whole schema from nothing — that is what
 * a fresh checkout, a new machine and the test harness all do — and the one
 * column ticket 01 adds is the one that must stay optional: an Article without
 * a cover is a normal Article.
 */
describe("the migration chain", () => {
  it("builds a nullable cover column that clears itself with the image", async () => {
    const harness = await createTestHarness();
    try {
      const columns = harness.database.sqlite.prepare("PRAGMA table_info(article)").all() as ColumnInfo[];
      const cover = columns.find((column) => column.name === "cover_asset_id");
      expect(cover, "article.cover_asset_id").toBeDefined();
      expect(cover?.notnull, "no cover must be a legal state").toBe(0);
      expect(cover?.dflt_value).toBeNull();

      const keys = harness.database.sqlite
        .prepare("PRAGMA foreign_key_list(article)")
        .all() as ForeignKeyInfo[];
      expect(keys.find((key) => key.from === "cover_asset_id")).toMatchObject({
        table: "asset",
        on_delete: "SET NULL",
      });
    } finally {
      await harness.close();
    }
  });

  it("sets the cover back to null when its image row goes away", async () => {
    const harness = await createTestHarness();
    try {
      const assetId = randomUUID();
      harness.database.sqlite
        .prepare(
          "INSERT INTO asset (id, file_name, mime_type, byte_size, width, height, content_hash, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(assetId, "cover.png", "image/png", 2048, 1600, 1000, "hash", "2025-06-01T00:00:00.000Z");
      harness.database.sqlite
        .prepare(
          "INSERT INTO article (id, default_locale, publication_state, publish_time, cover_asset_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run("article-1", "zh", "draft", null, assetId, "2025-06-01T00:00:00.000Z", "2025-06-01T00:00:00.000Z");

      harness.database.sqlite.prepare("DELETE FROM asset WHERE id = ?").run(assetId);

      const row = harness.database.sqlite
        .prepare("SELECT cover_asset_id AS cover FROM article WHERE id = ?")
        .get("article-1") as { cover: string | null };
      expect(row.cover).toBeNull();
    } finally {
      await harness.close();
    }
  });
});
