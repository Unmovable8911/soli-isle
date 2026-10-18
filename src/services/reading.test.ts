import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import type { Locale } from "@/config/site";
import type { Clock } from "@/domain/clock";
import { createAssetContext } from "@/services/assets";
import {
  addArticleTranslation,
  archiveArticle,
  createArticleContext,
  createArticleDraft,
  deleteArticlePermanently,
  publishArticle,
  updateArticleMeta,
  type ArticleContext,
} from "@/services/articles";
import { createCategory, type CategoryContext, type CategoryView } from "@/services/categories";
import { createTag, type TagContext, type TagView } from "@/services/tags";
import { createTestHarness, type TestHarness } from "@/test/harness";

import {
  createReadingContext,
  findArticleNeighbours,
  findReaderCategory,
  findReaderTag,
  hasCover,
  listArchiveArticles,
  listIndexableArticlePaths,
  listReaderCategories,
  listRecentArticles,
  listTombstonedSlugs,
  resolveBodyImages,
  searchArticles,
  type ReaderArticleCard,
  type ReadingContext,
} from "./reading";

interface Fixture {
  harness: TestHarness;
  clock: Clock;
  articles: ArticleContext;
  categories: CategoryContext;
  tags: TagContext;
  reading: ReadingContext;
}

const fixtures: Fixture[] = [];

async function createFixture(): Promise<Fixture> {
  const harness = await createTestHarness();
  const assets = createAssetContext(harness.database, harness.clock, harness.resources.rootDir);
  const articles = createArticleContext(harness.database, harness.clock, assets);
  const fixture: Fixture = {
    harness,
    clock: harness.clock,
    articles,
    categories: articles,
    tags: articles,
    reading: createReadingContext(harness.database, harness.clock),
  };
  fixtures.push(fixture);
  return fixture;
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await fixture.harness.close();
  }
});

interface SeedInput {
  title: string;
  summary?: string;
  locale?: Locale;
  /** Extra Locale versions beside the first one. */
  alsoIn?: Locale[];
  publishTime: string;
  markdown?: string;
  categoryId?: string;
  tagIds?: string[];
}

interface Seeded {
  id: string;
  slug: string;
}

async function seedPublished(fixture: Fixture, input: SeedInput): Promise<Seeded> {
  const locale = input.locale ?? "zh";
  const draft = await createArticleDraft(fixture.articles, {
    title: input.title,
    summary: input.summary ?? "",
    locale,
    bodyJson: JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: input.markdown ?? "body" }],
        },
      ],
    }),
  });

  for (const extra of input.alsoIn ?? []) {
    await addArticleTranslation(fixture.articles, {
      articleId: draft.id,
      locale: extra,
      title: `${input.title} (${extra})`,
      summary: `${input.summary ?? ""} (${extra})`,
    });
  }

  if (input.categoryId !== undefined || input.tagIds !== undefined) {
    await updateArticleMeta(fixture.articles, {
      articleId: draft.id,
      categoryId: input.categoryId ?? null,
      tagIds: input.tagIds ?? [],
    });
  }

  const published = await publishArticle(fixture.articles, {
    articleId: draft.id,
    publishTime: input.publishTime,
  });
  if (!published.ok) {
    throw new Error(`could not publish: ${published.reason}`);
  }
  return { id: draft.id, slug: published.article.slug };
}

function titles(cards: readonly ReaderArticleCard[]): string[] {
  return cards.map((card) => card.title);
}

async function seedCategory(
  fixture: Fixture,
  input: Parameters<typeof createCategory>[1],
): Promise<CategoryView> {
  const outcome = await createCategory(fixture.categories, input);
  if (!outcome.ok) {
    throw new Error(`could not create category: ${outcome.reason}`);
  }
  return outcome.category;
}

async function seedTag(fixture: Fixture, input: Parameters<typeof createTag>[1]): Promise<TagView> {
  const outcome = await createTag(fixture.tags, input);
  if (!outcome.ok) {
    throw new Error(`could not create tag: ${outcome.reason}`);
  }
  return outcome.tag;
}

describe("recent articles", () => {
  it("lists published Articles newest first with the fields a card shows", async () => {
    const fixture = await createFixture();
    const category = await seedCategory(fixture, { locale: "zh", name: "笔记" });
    const tag = await seedTag(fixture, { locale: "zh", name: "编辑器" });

    await seedPublished(fixture, {
      title: "Older",
      summary: "older summary",
      publishTime: "2025-06-01T00:00:00.000Z",
    });
    await seedPublished(fixture, {
      title: "Newer",
      summary: "newer summary",
      publishTime: "2025-06-10T00:00:00.000Z",
      categoryId: category.id,
      tagIds: [tag.id],
    });

    const cards = await listRecentArticles(fixture.reading, { locale: "zh" });

    expect(titles(cards)).toEqual(["Newer", "Older"]);
    expect(cards[0]).toMatchObject({
      title: "Newer",
      summary: "newer summary",
      publishTime: "2025-06-10T00:00:00.000Z",
      slug: "newer",
      category: { path: "笔记", name: "笔记" },
    });
    expect(cards[0]?.tags).toEqual([{ slug: "编辑器", name: "编辑器" }]);
    expect(cards[1]?.category).toBeNull();
  });

  it("shows a Category and Tag name in the Reader's Locale, falling back to the one that exists", async () => {
    const fixture = await createFixture();
    // Latin slugs, so a Reader shown a slug instead of a name is unmistakable.
    const category = await seedCategory(fixture, {
      locale: "zh",
      name: "笔记",
      slug: "notes",
    });
    const tag = await seedTag(fixture, { locale: "zh", name: "编辑器", slug: "editor" });
    await seedPublished(fixture, {
      title: "Both bodies, one set of names",
      locale: "zh",
      alsoIn: ["en"],
      publishTime: "2025-06-01T00:00:00.000Z",
      categoryId: category.id,
      tagIds: [tag.id],
    });

    const noEnglish = await listRecentArticles(fixture.reading, { locale: "en" });
    expect(noEnglish[0]?.category).toEqual({ slug: "notes", path: "notes", name: "笔记" });
    expect(noEnglish[0]?.tags).toEqual([{ slug: "editor", name: "编辑器" }]);
  });

  it("hides drafts, archived Articles and Articles whose Publish Time has not arrived", async () => {
    const fixture = await createFixture();
    await createArticleDraft(fixture.articles, { title: "Draft", locale: "zh" });
    const archived = await seedPublished(fixture, {
      title: "Archived",
      publishTime: "2025-06-02T00:00:00.000Z",
    });
    await archiveArticle(fixture.articles, { articleId: archived.id });
    await seedPublished(fixture, {
      title: "Scheduled",
      publishTime: "2025-07-01T00:00:00.000Z",
    });
    await seedPublished(fixture, { title: "Live", publishTime: "2025-06-03T00:00:00.000Z" });

    const cards = await listRecentArticles(fixture.reading, { locale: "zh" });

    expect(titles(cards)).toEqual(["Live"]);
  });

  it("shows only Articles that have a version in the current Locale", async () => {
    const fixture = await createFixture();
    await seedPublished(fixture, {
      title: "Chinese only",
      publishTime: "2025-06-05T00:00:00.000Z",
    });
    await seedPublished(fixture, {
      title: "Both languages",
      publishTime: "2025-06-04T00:00:00.000Z",
      alsoIn: ["en"],
    });

    expect(titles(await listRecentArticles(fixture.reading, { locale: "en" }))).toEqual([
      "Both languages (en)",
    ]);
    expect(titles(await listRecentArticles(fixture.reading, { locale: "zh" }))).toEqual([
      "Chinese only",
      "Both languages",
    ]);
  });

  it("honours a limit", async () => {
    const fixture = await createFixture();
    for (const day of [1, 2, 3]) {
      await seedPublished(fixture, {
        title: `Day ${day}`,
        publishTime: `2025-06-0${day}T00:00:00.000Z`,
      });
    }

    expect(await listRecentArticles(fixture.reading, { locale: "zh", limit: 2 })).toHaveLength(2);
  });
});

describe("category browsing", () => {
  it("returns the tree with localised names and Article counts", async () => {
    const fixture = await createFixture();
    const notes = await seedCategory(fixture, { locale: "zh", name: "笔记" });
    fixture.harness.database.sqlite
      .prepare("INSERT INTO category_translation (category_id, locale, name) VALUES (?, ?, ?)")
      .run(notes.id, "en", "Notes");
    const tools = await seedCategory(fixture, {
      locale: "zh",
      name: "工具",
      parentId: notes.id,
    });
    await seedPublished(fixture, {
      title: "Tools post",
      publishTime: "2025-06-01T00:00:00.000Z",
      categoryId: tools.id,
      alsoIn: ["en"],
    });

    const tree = await listReaderCategories(fixture.reading, { locale: "en" });

    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ slug: "笔记", name: "Notes", count: 1 });
    expect(tree[0]?.children[0]).toMatchObject({ slug: "工具", name: "工具", count: 1 });
  });

  it("shows a Category's own Articles plus those of its descendants", async () => {
    const fixture = await createFixture();
    const notes = await seedCategory(fixture, { locale: "zh", name: "笔记" });
    const tools = await seedCategory(fixture, {
      locale: "zh",
      name: "工具",
      parentId: notes.id,
    });
    await seedPublished(fixture, {
      title: "At the root",
      publishTime: "2025-06-01T00:00:00.000Z",
      categoryId: notes.id,
    });
    await seedPublished(fixture, {
      title: "Nested",
      publishTime: "2025-06-02T00:00:00.000Z",
      categoryId: tools.id,
    });

    const found = await findReaderCategory(fixture.reading, {
      locale: "zh",
      categoryPath: "笔记",
    });

    expect(titles(found?.articles ?? [])).toEqual(["Nested", "At the root"]);
    expect(found?.breadcrumbs.map((crumb) => crumb.name)).toEqual(["笔记"]);
  });

  it("reports the full breadcrumb path for a nested Category", async () => {
    const fixture = await createFixture();
    const notes = await seedCategory(fixture, { locale: "zh", name: "笔记" });
    const tools = await seedCategory(fixture, {
      locale: "zh",
      name: "工具",
      parentId: notes.id,
    });
    await seedCategory(fixture, {
      locale: "zh",
      name: "编辑器",
      parentId: tools.id,
    });

    const found = await findReaderCategory(fixture.reading, {
      locale: "zh",
      categoryPath: "笔记/工具/编辑器",
    });

    expect(found?.breadcrumbs).toEqual([
      { slug: "笔记", path: "笔记", name: "笔记" },
      { slug: "工具", path: "笔记/工具", name: "工具" },
      { slug: "编辑器", path: "笔记/工具/编辑器", name: "编辑器" },
    ]);
    expect(found?.category.children).toEqual([]);
  });

  it("has nothing for an unknown Category path", async () => {
    const fixture = await createFixture();
    expect(
      await findReaderCategory(fixture.reading, { locale: "zh", categoryPath: "missing" }),
    ).toBeNull();
  });
});

describe("tag browsing", () => {
  it("lists every Article sharing the Tag, newest first", async () => {
    const fixture = await createFixture();
    const tag = await seedTag(fixture, { locale: "zh", name: "编辑器" });
    await seedPublished(fixture, {
      title: "First",
      publishTime: "2025-06-01T00:00:00.000Z",
      tagIds: [tag.id],
    });
    await seedPublished(fixture, {
      title: "Second",
      publishTime: "2025-06-02T00:00:00.000Z",
      tagIds: [tag.id],
    });
    await seedPublished(fixture, { title: "Untagged", publishTime: "2025-06-03T00:00:00.000Z" });

    const found = await findReaderTag(fixture.reading, { locale: "zh", slug: "编辑器" });

    expect(found?.tag).toEqual({ slug: "编辑器", name: "编辑器" });
    expect(titles(found?.articles ?? [])).toEqual(["Second", "First"]);
  });

  it("has nothing for an unknown Tag", async () => {
    const fixture = await createFixture();
    expect(await findReaderTag(fixture.reading, { locale: "zh", slug: "nope" })).toBeNull();
  });
});

describe("archive", () => {
  it("lists every visible Article newest first, so months can be cut from it", async () => {
    const fixture = await createFixture();
    await seedPublished(fixture, { title: "June", publishTime: "2025-06-02T00:00:00.000Z" });
    await seedPublished(fixture, { title: "May", publishTime: "2025-05-02T00:00:00.000Z" });

    expect(titles(await listArchiveArticles(fixture.reading, { locale: "zh" }))).toEqual([
      "June",
      "May",
    ]);
  });
});

describe("search", () => {
  it("matches the title, the derived Markdown body, a Tag name and a Category name", async () => {
    const fixture = await createFixture();
    const category = await seedCategory(fixture, { locale: "zh", name: "笔记" });
    const tag = await seedTag(fixture, { locale: "zh", name: "编辑器" });

    await seedPublished(fixture, {
      title: "Highlighting",
      summary: "about code",
      publishTime: "2025-06-01T00:00:00.000Z",
      markdown: "plain words",
    });
    await seedPublished(fixture, {
      title: "Plain",
      publishTime: "2025-06-02T00:00:00.000Z",
      markdown: "this body mentions Highlighting once",
    });
    await seedPublished(fixture, {
      title: "Tagged",
      publishTime: "2025-06-03T00:00:00.000Z",
      tagIds: [tag.id],
    });
    await seedPublished(fixture, {
      title: "Filed",
      publishTime: "2025-06-04T00:00:00.000Z",
      categoryId: category.id,
    });

    const byTitle = await searchArticles(fixture.reading, { locale: "zh", query: "highlighting" });
    expect(byTitle.terms).toEqual(["highlighting"]);
    expect(titles(byTitle.results)).toEqual(["Highlighting", "Plain"]);

    const byBody = await searchArticles(fixture.reading, { locale: "zh", query: "this body" });
    expect(titles(byBody.results)).toEqual(["Plain"]);

    const byTag = await searchArticles(fixture.reading, { locale: "zh", query: "编辑器" });
    expect(titles(byTag.results)).toEqual(["Tagged"]);

    const byCategory = await searchArticles(fixture.reading, { locale: "zh", query: "笔记" });
    expect(titles(byCategory.results)).toEqual(["Filed"]);
  });

  it("gives a result the body prose around the match, and null when only the title matched", async () => {
    const fixture = await createFixture();
    await seedPublished(fixture, {
      title: "Highlighting in the title only",
      publishTime: "2025-06-01T00:00:00.000Z",
    });
    await seedPublished(fixture, {
      title: "Plain",
      publishTime: "2025-06-02T00:00:00.000Z",
      markdown: "a body that mentions highlighting somewhere",
    });

    const found = await searchArticles(fixture.reading, { locale: "zh", query: "highlighting" });

    expect(found.results[0]).toMatchObject({
      title: "Highlighting in the title only",
      snippet: null,
    });
    expect(found.results[1]?.title).toBe("Plain");
    expect(found.results[1]?.snippet).toContain("mentions highlighting somewhere");
  });

  it("finds a body word that was only ever saved as ProseMirror JSON", async () => {
    const fixture = await createFixture();
    await seedPublished(fixture, {
      title: "Saved as JSON only",
      publishTime: "2025-06-01T00:00:00.000Z",
      markdown: "the searchable phrase",
    });

    const found = await searchArticles(fixture.reading, { locale: "zh", query: "searchable" });
    expect(titles(found.results)).toEqual(["Saved as JSON only"]);
  });

  it("only searches the current Locale", async () => {
    const fixture = await createFixture();
    await seedPublished(fixture, {
      title: "Chinese only",
      publishTime: "2025-06-01T00:00:00.000Z",
      markdown: "關鍵詞",
    });

    expect(
      (await searchArticles(fixture.reading, { locale: "en", query: "關鍵詞" })).results,
    ).toEqual([]);
  });

  it("requires every keyword to match", async () => {
    const fixture = await createFixture();
    await seedPublished(fixture, {
      title: "Syntax highlighting",
      publishTime: "2025-06-01T00:00:00.000Z",
    });

    expect(
      titles((await searchArticles(fixture.reading, { locale: "zh", query: "syntax missing" })).results),
    ).toEqual([]);
    expect(
      titles((await searchArticles(fixture.reading, { locale: "zh", query: "syntax high" })).results),
    ).toEqual(["Syntax highlighting"]);
  });

  it("returns no results and no terms for an empty query", async () => {
    const fixture = await createFixture();
    await seedPublished(fixture, { title: "Any", publishTime: "2025-06-01T00:00:00.000Z" });

    expect(await searchArticles(fixture.reading, { locale: "zh", query: "   " })).toEqual({
      terms: [],
      results: [],
    });
  });

  it("treats LIKE wildcards as literal characters", async () => {
    const fixture = await createFixture();
    await seedPublished(fixture, { title: "100% done", publishTime: "2025-06-01T00:00:00.000Z" });
    await seedPublished(fixture, { title: "1000 done", publishTime: "2025-06-02T00:00:00.000Z" });

    expect(titles((await searchArticles(fixture.reading, { locale: "zh", query: "100%" })).results)).toEqual([
      "100% done",
    ]);
  });
});

describe("previous and next Article", () => {
  it("walks the locale list in publish order", async () => {
    const fixture = await createFixture();
    const older = await seedPublished(fixture, {
      title: "Older",
      publishTime: "2025-06-01T00:00:00.000Z",
    });
    const middle = await seedPublished(fixture, {
      title: "Middle",
      publishTime: "2025-06-02T00:00:00.000Z",
    });
    const newer = await seedPublished(fixture, {
      title: "Newer",
      publishTime: "2025-06-03T00:00:00.000Z",
    });

    const neighbours = await findArticleNeighbours(fixture.reading, {
      locale: "zh",
      articleId: middle.id,
    });

    expect(neighbours?.older).toMatchObject({ id: older.id, title: "Older" });
    expect(neighbours?.newer).toMatchObject({ id: newer.id, title: "Newer" });
  });

  it("keeps an archived Article in the chain, so an archived page still ends with navigation", async () => {
    const fixture = await createFixture();
    const older = await seedPublished(fixture, {
      title: "Older",
      publishTime: "2025-06-01T00:00:00.000Z",
    });
    const archived = await seedPublished(fixture, {
      title: "Archived",
      publishTime: "2025-06-02T00:00:00.000Z",
    });
    const newer = await seedPublished(fixture, {
      title: "Newer",
      publishTime: "2025-06-03T00:00:00.000Z",
    });
    await archiveArticle(fixture.articles, { articleId: archived.id });

    const neighbours = await findArticleNeighbours(fixture.reading, {
      locale: "zh",
      articleId: archived.id,
    });

    expect(neighbours?.older).toMatchObject({ id: older.id });
    expect(neighbours?.newer).toMatchObject({ id: newer.id });
  });

  it("leaves archived Articles out of the lists that are not a URL chain", async () => {
    const fixture = await createFixture();
    await seedPublished(fixture, { title: "Visible", publishTime: "2025-06-01T00:00:00.000Z" });
    const archived = await seedPublished(fixture, {
      title: "Archived",
      publishTime: "2025-06-02T00:00:00.000Z",
    });
    await archiveArticle(fixture.articles, { articleId: archived.id });

    expect(titles(await listRecentArticles(fixture.reading, { locale: "zh" }))).toEqual([
      "Visible",
    ]);
  });

  it("has no neighbour at either end", async () => {
    const fixture = await createFixture();
    const only = await seedPublished(fixture, {
      title: "Only",
      publishTime: "2025-06-01T00:00:00.000Z",
    });

    expect(await findArticleNeighbours(fixture.reading, { locale: "zh", articleId: only.id })).toEqual(
      { older: null, newer: null },
    );
  });

  it("skips Articles that have no version in the current Locale", async () => {
    const fixture = await createFixture();
    const older = await seedPublished(fixture, {
      title: "Older",
      publishTime: "2025-06-01T00:00:00.000Z",
      alsoIn: ["en"],
    });
    const middle = await seedPublished(fixture, {
      title: "Middle",
      publishTime: "2025-06-02T00:00:00.000Z",
      alsoIn: ["en"],
    });
    // Chinese only, and it sits between the two English ones.
    await seedPublished(fixture, { title: "Chinese", publishTime: "2025-06-03T00:00:00.000Z" });
    const newer = await seedPublished(fixture, {
      title: "Newer",
      publishTime: "2025-06-04T00:00:00.000Z",
      alsoIn: ["en"],
    });

    const neighbours = await findArticleNeighbours(fixture.reading, {
      locale: "en",
      articleId: middle.id,
    });

    expect(neighbours?.older).toMatchObject({ id: older.id });
    expect(neighbours?.newer).toMatchObject({ id: newer.id });
  });
});

describe("sitemap", () => {
  it("lists one URL per Locale version of each visible Article", async () => {
    const fixture = await createFixture();
    await seedPublished(fixture, {
      title: "Both",
      publishTime: "2025-06-01T00:00:00.000Z",
      alsoIn: ["en"],
    });
    await seedPublished(fixture, { title: "Chinese only", publishTime: "2025-06-02T00:00:00.000Z" });

    const paths = await listIndexableArticlePaths(fixture.reading);

    expect(paths.map((entry) => entry.path).sort()).toEqual([
      "/en/articles/both",
      "/zh/articles/both",
      "/zh/articles/chinese-only",
    ]);
    expect(paths[0]?.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("leaves out archived, scheduled and permanently deleted Articles", async () => {
    const fixture = await createFixture();
    const archived = await seedPublished(fixture, {
      title: "Archived",
      publishTime: "2025-06-01T00:00:00.000Z",
    });
    await archiveArticle(fixture.articles, { articleId: archived.id });
    await seedPublished(fixture, { title: "Future", publishTime: "2025-07-01T00:00:00.000Z" });
    const deleted = await seedPublished(fixture, {
      title: "Deleted",
      publishTime: "2025-06-02T00:00:00.000Z",
    });
    await deleteArticlePermanently(fixture.articles, deleted.id);

    expect(await listIndexableArticlePaths(fixture.reading)).toEqual([]);
  });
});

describe("permanently removed slugs", () => {
  it("lists the slug of a permanently deleted Article and keeps it out of the sitemap", async () => {
    const fixture = await createFixture();
    const deleted = await seedPublished(fixture, {
      title: "Gone",
      publishTime: "2025-06-02T00:00:00.000Z",
    });
    await deleteArticlePermanently(fixture.articles, deleted.id);

    expect(await listTombstonedSlugs(fixture.reading)).toEqual(["gone"]);
  });

  it("never lists a slug that still belongs to an Article", async () => {
    const fixture = await createFixture();
    await seedPublished(fixture, { title: "Alive", publishTime: "2025-06-02T00:00:00.000Z" });

    expect(await listTombstonedSlugs(fixture.reading)).toEqual([]);
  });
});

describe("body images", () => {
  const ASSET_ID = "3f4b1c9e-5f0a-4b8b-9d3a-4f6a1c2b3d4e";

  it("resolves the original address and the stored dimensions of a referenced Asset", async () => {
    const fixture = await createFixture();
    fixture.harness.database.sqlite
      .prepare(
        "INSERT INTO asset (id, file_name, mime_type, byte_size, width, height, content_hash, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(ASSET_ID, "tall.png", "image/png", 2048, 900, 4000, "hash", "2025-06-15T08:00:00.000Z");
    fixture.harness.database.sqlite
      .prepare(
        "INSERT INTO asset_variant (asset_id, variant, byte_size, width, height, format) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(ASSET_ID, "original", 2048, 900, 4000, "png");

    const images = await resolveBodyImages(
      fixture.reading,
      JSON.stringify({
        type: "doc",
        content: [{ type: "image", attrs: { src: `/media/${ASSET_ID}/display.webp` } }],
      }),
    );

    expect(images.get(ASSET_ID)).toEqual({
      original: `/media/${ASSET_ID}/original.png`,
      width: 900,
      height: 4000,
    });
  });

  it("ignores addresses that are not stored Assets", async () => {
    const fixture = await createFixture();
    const images = await resolveBodyImages(
      fixture.reading,
      JSON.stringify({
        type: "doc",
        content: [{ type: "image", attrs: { src: `/media/${ASSET_ID}/display.webp` } }],
      }),
    );

    expect(images.size).toBe(0);
  });
});
describe("the cover on a card", () => {
  /** An upload always has a display variant; the card is served that one. */
  function insertCover(fixture: Fixture, assetId: string, width: number, height: number): void {
    const sqlite = fixture.harness.database.sqlite;
    sqlite
      .prepare(
        "INSERT INTO asset (id, file_name, mime_type, byte_size, width, height, content_hash, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(assetId, "cover.png", "image/png", 2048, width, height, "hash", "2025-06-01T00:00:00.000Z");
    sqlite
      .prepare(
        "INSERT INTO asset_variant (asset_id, variant, byte_size, width, height, format) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(assetId, "display", 900, width, height, "webp");
  }

  it("carries the cover address and the ratio the crop needs", async () => {
    const fixture = await createFixture();
    const seeded = await seedPublished(fixture, {
      title: "Covered",
      publishTime: "2025-06-01T00:00:00.000Z",
    });
    const coverId = randomUUID();
    insertCover(fixture, coverId, 1600, 1000);
    await updateArticleMeta(fixture.articles, { articleId: seeded.id, coverAssetId: coverId });

    const cards = await listRecentArticles(fixture.reading, { locale: "zh" });

    expect(cards[0]?.cover).toEqual({
      address: `/media/${coverId}/display.webp`,
      width: 1600,
      height: 1000,
    });
  });

  it("has no cover when the Article has none", async () => {
    const fixture = await createFixture();
    await seedPublished(fixture, { title: "Plain", publishTime: "2025-06-01T00:00:00.000Z" });

    const cards = await listRecentArticles(fixture.reading, { locale: "zh" });

    expect(cards[0]?.cover).toBeNull();
  });

  it.each(["search", "archive", "neighbours"] as const)(
    "carries the cover on %s results too",
    async (surface) => {
      const fixture = await createFixture();
      const older = await seedPublished(fixture, {
        title: "Older",
        publishTime: "2025-06-01T00:00:00.000Z",
      });
      const newer = await seedPublished(fixture, {
        title: "Newer",
        publishTime: "2025-06-02T00:00:00.000Z",
      });
      const coverId = randomUUID();
      insertCover(fixture, coverId, 1600, 1000);
      await updateArticleMeta(fixture.articles, { articleId: newer.id, coverAssetId: coverId });

      const address = `/media/${coverId}/display.webp`;
      if (surface === "search") {
        const found = await searchArticles(fixture.reading, { locale: "zh", query: "Newer" });
        expect(found.results[0]?.cover?.address).toBe(address);
      } else if (surface === "archive") {
        const listed = await listArchiveArticles(fixture.reading, { locale: "zh" });
        expect(listed.map((card) => card.cover?.address ?? null)).toEqual([address, null]);
      } else {
        const neighbours = await findArticleNeighbours(fixture.reading, {
          locale: "zh",
          articleId: older.id,
        });
        expect(neighbours?.newer?.cover?.address).toBe(address);
      }
    },
  );
});

describe("a card's cover", () => {
  const cover = { address: "/media/01JCOVER/display.webp", width: 1600, height: 1000 };

  it("is one nullable field with one test, shared by every surface", () => {
    // "No cover" is a legal Article, not a missing one: null is the only way to
    // say so, and the predicate is the only way to ask.
    expect(hasCover(null)).toBe(false);
    expect(hasCover(cover)).toBe(true);
  });
});
