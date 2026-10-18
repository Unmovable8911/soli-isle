import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { createAssetContext, listAssets, type AssetContext } from "@/services/assets";
import { createTestHarness, type TestHarness } from "@/test/harness";

import {
  finishMutation,
  groupBy,
  InvalidArticleBodyError,
  InvalidPostBodyError,
  localeOrder,
  syncTranslationAssets,
} from "./content";

describe("the shared record shapes", () => {
  it("groups rows by key, keeping the order it was given", () => {
    const rows = [
      { locale: "zh", id: "1" },
      { locale: "en", id: "2" },
      { locale: "zh", id: "3" },
    ];

    expect([...groupBy(rows, (row) => row.locale)]).toEqual([
      ["zh", [rows[0], rows[2]]],
      ["en", [rows[1]]],
    ]);
  });

  it("orders Locales as the site configures them", () => {
    expect(localeOrder("zh")).toBe(0);
    expect(localeOrder("en")).toBe(1);
  });
});

describe("the mutation result", () => {
  it("hands the reloaded record back under the caller's own key", () => {
    expect(finishMutation("article", () => ({ id: "01" }))).toEqual({
      ok: true,
      article: { id: "01" },
    });
    expect(finishMutation("post", () => ({ id: "02" }))).toEqual({ ok: true, post: { id: "02" } });
  });

  it("reports the row that vanished between the write and the read", () => {
    expect(finishMutation("article", () => null)).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("invalid bodies", () => {
  it("keeps one validation behind two named errors", () => {
    expect(new InvalidArticleBodyError()).toBeInstanceOf(Error);
    expect(new InvalidArticleBodyError().name).toBe("InvalidArticleBodyError");
    expect(new InvalidArticleBodyError().message).toContain("article body");
    expect(new InvalidPostBodyError()).toBeInstanceOf(Error);
    expect(new InvalidPostBodyError().name).toBe("InvalidPostBodyError");
    expect(new InvalidPostBodyError().message).toContain("post body");
  });
});

describe("asset reference sync", () => {
  const fixtures: { harness: TestHarness; assets: AssetContext }[] = [];

  async function createFixture(): Promise<{ harness: TestHarness; assets: AssetContext }> {
    const harness = await createTestHarness();
    const assets = createAssetContext(harness.database, harness.clock, harness.resources.rootDir);
    const fixture = { harness, assets };
    fixtures.push(fixture);
    return fixture;
  }

  afterEach(async () => {
    for (const fixture of fixtures.splice(0)) {
      await fixture.harness.close();
    }
  });

  function insertAsset(harness: TestHarness, assetId: string): void {
    harness.database.sqlite
      .prepare(
        "INSERT INTO asset (id, file_name, mime_type, byte_size, width, height, content_hash, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(assetId, "hero.png", "image/png", 1024, 1600, 900, "hash", "2025-06-15T08:00:00.000Z");
  }

  function referenced(harness: TestHarness): { content_kind: string; content_id: string }[] {
    return harness.database.sqlite
      .prepare("SELECT content_kind, content_id FROM asset_reference ORDER BY content_kind")
      .all() as { content_kind: string; content_id: string }[];
  }

  it("scans the JSON, the derived Markdown and the addresses a work carries outside a body", async () => {
    const { harness, assets } = await createFixture();
    const inJson = randomUUID();
    const inMarkdown = randomUUID();
    const attached = randomUUID();
    for (const assetId of [inJson, inMarkdown, attached]) {
      insertAsset(harness, assetId);
    }

    await syncTranslationAssets(
      { assets },
      {
        contentKind: "post",
        contentId: "01JX3Z8Q4A0W7Y6TCVN1KH2M9R",
        translations: [
          {
            bodyJson: `{"type":"image","attrs":{"src":"/media/${inJson}/display.webp"}}`,
            bodyMarkdown: `![](/media/${inMarkdown}/display.webp)`,
          },
        ],
        extra: [`/media/${attached}/display.webp`],
      },
    );

    expect(referenced(harness).map((row) => row.content_kind)).toEqual(["post", "post", "post"]);
    expect((await listAssets(assets)).map((asset) => asset.id).sort()).toEqual(
      [inJson, inMarkdown, attached].sort(),
    );
  });
});
