import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import { getArticle, createArticleContext, listArticles } from "@/services/articles";
import { createAssetContext, getAssetVariantFile, listAssets } from "@/services/assets";
import { createPostContext } from "@/services/posts";
import { createReadingContext, listArchiveArticles } from "@/services/reading";
import { createTestHarness, type TestHarness } from "@/test/harness";
import { renderArticleBody } from "@/editor/render/render-article";

import {
  DemoSeedRefusedError,
  assertLocalSeed,
  parseSeedArguments,
  seedDemo,
  type DemoSeedContext,
} from "./demo-seed";

interface SeedFixture {
  harness: TestHarness;
  context: DemoSeedContext;
}

const fixtures: SeedFixture[] = [];
const temporaryDirectories: string[] = [];

async function createSeedFixture(imagesDir: string | null = null): Promise<SeedFixture> {
  const harness = await createTestHarness();
  const assets = createAssetContext(harness.database, harness.clock, harness.resources.rootDir);
  const fixture: SeedFixture = {
    harness,
    context: {
      database: harness.database,
      assets,
      articles: createArticleContext(harness.database, harness.clock, assets),
      posts: createPostContext(harness.database, harness.clock, assets),
      reading: createReadingContext(harness.database, harness.clock),
      resourceDir: harness.resources.rootDir,
      imagesDir,
    },
  };
  fixtures.push(fixture);
  return fixture;
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await fixture.harness.close();
  }
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

const TABLES = [
  "article",
  "article_translation",
  "article_slug",
  "article_revision",
  "category",
  "category_translation",
  "tag",
  "tag_translation",
  "post",
  "post_translation",
  "post_image",
  "asset",
  "asset_variant",
  "asset_reference",
] as const;

/** Everything a re-run must leave untouched, as one comparable fingerprint. */
function fingerprint(harness: TestHarness): Record<string, number> {
  return Object.fromEntries(
    TABLES.map((table) => {
      const row = harness.database.sqlite
        .prepare(`SELECT count(*) AS total FROM ${table}`)
        .get() as { total: number };
      return [table, row.total];
    }),
  );
}

describe("the demo seed guard", () => {
  it("refuses to run where the content would be real", () => {
    expect(() => assertLocalSeed({ NODE_ENV: "production" })).toThrow(DemoSeedRefusedError);
  });

  it.each([{}, { NODE_ENV: "development" }, { NODE_ENV: "test" }])("runs locally (%o)", (env) => {
    expect(() => assertLocalSeed(env)).not.toThrow();
  });
});

describe("the demo seed arguments", () => {
  it("draws its own placeholders unless told where the author's images are", () => {
    expect(parseSeedArguments([])).toEqual({ imagesDir: null });
    expect(parseSeedArguments(["--images", "./pictures"])).toEqual({ imagesDir: "./pictures" });
  });

  it("refuses a flag it cannot honour instead of guessing", () => {
    expect(() => parseSeedArguments(["--images"])).toThrow(/--images/);
    expect(() => parseSeedArguments(["--force"])).toThrow(/--force/);
  });
});

describe("the demo seed", () => {
  it("publishes the demo works a Reader can list", async () => {
    const { context } = await createSeedFixture();
    await seedDemo(context);

    const zh = await listArchiveArticles(context.reading, { locale: "zh" });
    expect(zh.map((card) => card.title)).toEqual(["一篇元素齐全的长文", "没有封面的长文"]);
    expect(zh[0]?.cover).not.toBeNull();
    expect(zh[1]?.cover).toBeNull();
    expect(zh[0]?.category?.slug).toBe("on-writing");
    expect(zh[0]?.tags.map((tag) => tag.slug)).toEqual(["engineering", "writing"]);

    // The same work answers in English: one work, two Locale versions.
    const english = await listArchiveArticles(context.reading, { locale: "en" });
    expect(english.map((card) => card.title)).toEqual([
      "A Long Essay, Element by Element",
      "An English Essay",
    ]);
  });

  it("gives the long article every element the spec asks a long article to carry", async () => {
    const { context } = await createSeedFixture();
    await seedDemo(context);

    const summary = (await listArticles(context.articles)).find(
      (article) => article.slug === "element-by-element",
    );
    const detail = await getArticle(context.articles, summary?.id ?? "");
    const body = detail?.translations.find((translation) => translation.locale === "zh")?.bodyJson ?? "";
    const html = await renderArticleBody(body);

    expect(html.match(/<h2/g) ?? []).toHaveLength(4);
    expect(html).toContain("<table");
    expect(html).toContain("katex");
    expect(html).toContain("<details");
    expect(html).toContain("callout");
    expect(html).toContain("footnote");
    expect(html).toContain("<pre");
    expect(html).toContain("<img");
  });

  it("pushes every image through the real pipeline, so sharp made the variants", async () => {
    const { context } = await createSeedFixture();
    await seedDemo(context);

    const assets = await listAssets(context.assets);
    expect(assets).toHaveLength(6);
    for (const asset of assets) {
      const display = await getAssetVariantFile(context.assets, asset.id, "display");
      const thumb = await getAssetVariantFile(context.assets, asset.id, "thumb");
      const original = await getAssetVariantFile(context.assets, asset.id, "original");
      expect(display?.mimeType, asset.fileName).toBe("image/webp");
      expect(thumb?.mimeType, asset.fileName).toBe("image/webp");
      expect(original?.mimeType, asset.fileName).toBe("image/png");
      // Every image the seed uploads is one the seed also attaches, cover included.
      expect(asset.references.length, asset.fileName).toBeGreaterThan(0);
      expect(asset.isOrphan, asset.fileName).toBe(false);
    }
  });

  it("is re-runnable: a second run replaces the demo set instead of doubling it", async () => {
    const { harness, context } = await createSeedFixture();
    await seedDemo(context);
    const first = fingerprint(harness);
    const firstSlugs = harness.database.sqlite
      .prepare("SELECT slug FROM article_slug ORDER BY slug")
      .all();

    await seedDemo(context);

    expect(fingerprint(harness)).toEqual(first);
    expect(
      harness.database.sqlite.prepare("SELECT slug FROM article_slug ORDER BY slug").all(),
    ).toEqual(firstSlugs);
    await expect(listAssets(context.assets)).resolves.toHaveLength(6);
  });

  it("uses the author's own images when given a directory", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "soli-isle-images-"));
    temporaryDirectories.push(directory);
    const bytes = await sharp({
      create: { width: 900, height: 600, channels: 3, background: { r: 40, g: 60, b: 50 } },
    })
      .png()
      .toBuffer();
    await writeFile(path.join(directory, "mine.png"), bytes);

    const { context } = await createSeedFixture(directory);
    await seedDemo(context);

    const assets = await listAssets(context.assets);
    expect(assets.map((asset) => asset.fileName)).toEqual(Array(6).fill("mine.png"));
    expect(assets[0]?.width).toBe(900);
  });
});
