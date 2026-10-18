import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import type { Clock } from "@/domain/clock";
import { extractAssetIds } from "@/domain/asset-address";
import { createAssetContext, listAssets } from "@/services/assets";
import { createCategory } from "@/services/categories";
import { createTag } from "@/services/tags";
import { createTestHarness, type TestHarness } from "@/test/harness";

import {
  addArticleTranslation,
  archiveArticle,
  captureAutomaticRevision,
  createArticleContext,
  createArticleDraft,
  deleteArticlePermanently,
  findReadableArticle,
  getArticle,
  listArticles,
  listPublishedArticles,
  listRevisions,
  publishArticle,
  removeArticleTranslation,
  resolveArticleSlug,
  restoreRevision,
  saveArticleTranslation,
  unarchiveArticle,
  updateArticleMeta,
  type ArticleContext,
} from "./articles";

const DOC =
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hello"}]}]}';

interface ManualClock extends Clock {
  advance(ms: number): void;
}

function manualClock(startIso: string): ManualClock {
  let current = new Date(startIso);
  return {
    now: () => new Date(current),
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

interface Fixture {
  harness: TestHarness;
  clock: ManualClock;
  articles: ArticleContext;
}

const fixtures: Fixture[] = [];

async function createFixture(startIso = "2025-06-15T08:30:00.000Z"): Promise<Fixture> {
  const harness = await createTestHarness();
  const clock = manualClock(startIso);
  const assets = createAssetContext(harness.database, clock, harness.resources.rootDir);
  const articles = createArticleContext(harness.database, clock, assets);
  const fixture = { harness, clock, articles };
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

function bodyWithImage(assetId: string): string {
  return JSON.stringify({
    type: "doc",
    content: [{ type: "image", attrs: { src: `/media/${assetId}/display.webp` } }],
  });
}

describe("article drafts", () => {
  it("creates a draft with a slug derived from the title and one translation", async () => {
    const { articles } = await createFixture();

    const article = await createArticleDraft(articles, { title: "Hello, World", locale: "zh" });

    expect(article).toMatchObject({
      slug: "hello-world",
      defaultLocale: "zh",
      publicationState: "draft",
      publishTime: null,
      visibility: "draft",
    });
    expect(article.translations).toEqual([
      expect.objectContaining({ locale: "zh", title: "Hello, World" }),
    ]);
    expect(article.createdAt).toBe("2025-06-15T08:30:00.000Z");
  });

  it("creates a blank draft whose slug falls back to a usable value", async () => {
    const { articles } = await createFixture();

    const article = await createArticleDraft(articles, { title: "  ", locale: "zh" });

    expect(article.slug).toBe("article");
    expect(article.translations[0]).toMatchObject({ locale: "zh", title: "" });
  });

  it("numbers colliding slugs so two drafts can share a title", async () => {
    const { articles } = await createFixture();

    const first = await createArticleDraft(articles, { title: "Same Title", locale: "zh" });
    const second = await createArticleDraft(articles, { title: "Same Title", locale: "zh" });

    expect(first.slug).toBe("same-title");
    expect(second.slug).toBe("same-title-2");
  });

  it("derives the Markdown column from the ProseMirror JSON it was given", async () => {
    const { articles, harness } = await createFixture();

    const article = await createArticleDraft(articles, {
      title: "Body",
      locale: "zh",
      bodyJson: DOC,
    });

    const row = harness.database.sqlite
      .prepare("SELECT body_json, body_markdown FROM article_translation WHERE article_id = ?")
      .get(article.id) as { body_json: string; body_markdown: string };

    expect(row).toEqual({ body_json: DOC, body_markdown: "hello" });
  });

  it("re-derives the Markdown on a body save and keeps it on a title-only save", async () => {
    const { articles, harness } = await createFixture();
    const article = await createArticleDraft(articles, {
      title: "Body",
      locale: "zh",
      bodyJson: DOC,
    });
    const stored = () =>
      (
        harness.database.sqlite
          .prepare("SELECT body_markdown FROM article_translation WHERE article_id = ?")
          .get(article.id) as { body_markdown: string }
      ).body_markdown;

    await saveArticleTranslation(articles, {
      articleId: article.id,
      locale: "zh",
      baseVersion: 1,
      bodyJson:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"changed"}]}]}',
    });
    expect(stored()).toBe("changed");

    await saveArticleTranslation(articles, {
      articleId: article.id,
      locale: "zh",
      baseVersion: 2,
      title: "Just the title",
    });
    expect(stored()).toBe("changed");
  });

  it("rejects a body that is not a ProseMirror document", async () => {
    const { articles } = await createFixture();

    await expect(
      createArticleDraft(articles, { title: "Bad", locale: "zh", bodyJson: "{oops" }),
    ).rejects.toThrowError(/body/i);
  });

  it("lists drafts newest first", async () => {
    const { articles, clock } = await createFixture();

    const older = await createArticleDraft(articles, { title: "Older", locale: "zh" });
    clock.advance(1000);
    const newer = await createArticleDraft(articles, { title: "Newer", locale: "zh" });

    const listed = await listArticles(articles);
    expect(listed.map((article) => article.id)).toEqual([newer.id, older.id]);
  });
});

describe("article translations", () => {
  it("keeps at most one translation per locale", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "One", locale: "zh" });

    const outcome = await addArticleTranslation(articles, {
      articleId: article.id,
      locale: "zh",
      title: "Again",
    });

    expect(outcome).toEqual({ ok: false, reason: "duplicate-locale" });
  });

  it("enforces the per-locale uniqueness in the database as well", async () => {
    const { articles, harness } = await createFixture();
    const article = await createArticleDraft(articles, { title: "One", locale: "zh" });

    expect(() =>
      harness.database.sqlite
        .prepare(
          "INSERT INTO article_translation (article_id, locale, title, summary, body_json, body_markdown, created_at, updated_at) VALUES (?, ?, '', '', '', '', '', '')",
        )
        .run(article.id, "zh"),
    ).toThrowError(/UNIQUE/i);
  });

  it("adds a second locale version with its own title, summary and body", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "中文标题", locale: "zh" });

    const outcome = await addArticleTranslation(articles, {
      articleId: article.id,
      locale: "en",
      title: "English title",
      summary: "Summary",
      bodyJson: DOC,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.article.translations).toEqual([
      expect.objectContaining({ locale: "zh", title: "中文标题" }),
      expect.objectContaining({ locale: "en", title: "English title", summary: "Summary" }),
    ]);
  });

  it("removes one locale version without touching the others", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Both", locale: "zh" });
    await addArticleTranslation(articles, { articleId: article.id, locale: "en", title: "Both" });

    const outcome = await removeArticleTranslation(articles, {
      articleId: article.id,
      locale: "en",
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.article.translations.map((translation) => translation.locale)).toEqual(["zh"]);
  });

  it("refuses to remove the default locale version", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Both", locale: "zh" });
    await addArticleTranslation(articles, { articleId: article.id, locale: "en", title: "Both" });

    await expect(
      removeArticleTranslation(articles, { articleId: article.id, locale: "zh" }),
    ).resolves.toEqual({ ok: false, reason: "default-locale" });
  });

  it("removes a version without touching the work's Slug, revisions, images or Tags", async () => {
    const { articles, harness } = await createFixture();
    const assetId = randomUUID();
    insertAsset(harness, assetId);
    const tag = await createTag(
      { database: harness.database, clock: articles.clock },
      { locale: "zh", name: "保留", slug: "kept" },
    );
    if (!tag.ok) throw new Error(`could not create tag: ${tag.reason}`);

    const article = await createArticleDraft(articles, {
      title: "Both Locales",
      locale: "zh",
      bodyJson: bodyWithImage(assetId),
    });
    await addArticleTranslation(articles, { articleId: article.id, locale: "en", title: "Both" });
    await updateArticleMeta(articles, {
      articleId: article.id,
      tagIds: [tag.tag.id],
    });
    await publishArticle(articles, { articleId: article.id });
    const revisionsBefore = (await listRevisions(articles, article.id)).length;

    const removed = await removeArticleTranslation(articles, {
      articleId: article.id,
      locale: "en",
    });
    if (!removed.ok) throw new Error(`could not remove: ${removed.reason}`);

    expect(removed.article.id).toBe(article.id);
    expect(removed.article.slug).toBe(article.slug);
    expect(removed.article.translations.map((translation) => translation.locale)).toEqual(["zh"]);
    expect(removed.article.tags.map((tagged) => tagged.id)).toEqual([tag.tag.id]);
    expect(extractAssetIds(removed.article.translations[0]?.bodyJson ?? "")).toEqual([assetId]);
    // The publish snapshot of the removed Locale stays: history is not a version.
    expect((await listRevisions(articles, article.id)).length).toBe(revisionsBefore);
    const assets = await listAssets(articles.assets);
    expect(assets.map((asset) => asset.id)).toEqual([assetId]);
  });

  it("shows the version the changed defaultLocale names on a fallback page", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Both", locale: "zh" });
    await addArticleTranslation(articles, { articleId: article.id, locale: "en", title: "Both" });
    await publishArticle(articles, { articleId: article.id });

    // The work's default becomes English, which frees the Chinese version.
    const changed = await updateArticleMeta(articles, {
      articleId: article.id,
      defaultLocale: "en",
    });
    expect(changed.ok && changed.article.defaultLocale).toBe("en");
    await expect(
      removeArticleTranslation(articles, { articleId: article.id, locale: "zh" }),
    ).resolves.toMatchObject({ ok: true });

    const readable = await findReadableArticle(articles, { slug: article.slug, locale: "zh" });
    expect(readable.kind).toBe("found");
    if (readable.kind !== "found") return;
    expect(readable.translation.locale).toBe("en");
    expect(readable.fellBack).toBe(true);
    expect(readable.indexable).toBe(false);
  });

  it("refuses a version for the default Locale that no longer exists, and keeps the two", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Both", locale: "zh" });

    await expect(
      updateArticleMeta(articles, { articleId: article.id, defaultLocale: "en" }),
    ).resolves.toEqual({ ok: false, reason: "invalid-locale" });
    expect((await getArticle(articles, article.id))?.defaultLocale).toBe("zh");
  });

  it("saves content without creating a revision snapshot", async () => {
    const { articles, clock } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Draft", locale: "zh" });

    let version = article.translations[0].version;
    for (const title of ["one", "two", "three"]) {
      clock.advance(500);
      const outcome = await saveArticleTranslation(articles, {
        articleId: article.id,
        locale: "zh",
        baseVersion: version,
        title,
        bodyJson: DOC,
      });
      if (outcome.ok) version = outcome.article.translations[0].version;
    }

    await expect(listRevisions(articles, article.id)).resolves.toEqual([]);
  });

  it("records asset references for images in the body", async () => {
    const { articles, clock, harness } = await createFixture();
    const assetId = randomUUID();
    insertAsset(harness, assetId);
    const article = await createArticleDraft(articles, { title: "Images", locale: "zh" });

    await saveArticleTranslation(articles, {
      articleId: article.id,
      locale: "zh",
      baseVersion: article.translations[0].version,
      title: "Images",
      bodyJson: bodyWithImage(assetId),
    });

    const assets = createAssetContext(harness.database, clock, harness.resources.rootDir);
    const listed = await listAssets(assets);
    expect(listed.find((asset) => asset.id === assetId)?.references).toEqual([
      { contentKind: "article", contentId: article.id },
    ]);
  });

  it("drops asset references when the image leaves the body", async () => {
    const { articles, clock, harness } = await createFixture();
    const assetId = randomUUID();
    insertAsset(harness, assetId);
    const article = await createArticleDraft(articles, {
      title: "Images",
      locale: "zh",
      bodyJson: bodyWithImage(assetId),
    });

    await saveArticleTranslation(articles, {
      articleId: article.id,
      locale: "zh",
      baseVersion: article.translations[0].version,
      title: "Images",
      bodyJson: DOC,
    });

    const assets = createAssetContext(harness.database, clock, harness.resources.rootDir);
    const listed = await listAssets(assets);
    expect(listed.find((asset) => asset.id === assetId)?.references).toEqual([]);
  });
});

describe("optimistic concurrency on a translation", () => {
  async function draft(fixture: Fixture): Promise<{ articleId: string; version: number }> {
    const article = await createArticleDraft(fixture.articles, {
      title: "Base",
      locale: "zh",
      bodyJson: DOC,
    });
    const translation = article.translations[0];
    if (translation === undefined) {
      throw new Error("The draft has no translation");
    }
    return { articleId: article.id, version: translation.version };
  }

  it("starts a new translation version at 1 and bumps it on every save", async () => {
    const fixture = await createFixture();
    const { articleId, version } = await draft(fixture);

    const first = await saveArticleTranslation(fixture.articles, {
      articleId,
      locale: "zh",
      baseVersion: version,
      title: "Second",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.article.translations[0]?.version).toBe(2);

    const second = await saveArticleTranslation(fixture.articles, {
      articleId,
      locale: "zh",
      baseVersion: 2,
      title: "Third",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.article.translations[0]?.version).toBe(3);
  });

  it("refuses a save derived from an older version and returns the server copy", async () => {
    const fixture = await createFixture();
    const { articleId, version } = await draft(fixture);
    await saveArticleTranslation(fixture.articles, {
      articleId,
      locale: "zh",
      baseVersion: version,
      title: "Server wins",
      bodyJson: '{"type":"doc","content":[{"type":"paragraph"}]}',
    });

    const outcome = await saveArticleTranslation(fixture.articles, {
      articleId,
      locale: "zh",
      baseVersion: version,
      title: "Local loses",
    });

    expect(outcome).toEqual({
      ok: false,
      reason: "stale-content",
      current: expect.objectContaining({
        version: 2,
        title: "Server wins",
        bodyJson: '{"type":"doc","content":[{"type":"paragraph"}]}',
      }),
    });
  });

  it("leaves the stored translation untouched when a stale save is refused", async () => {
    const fixture = await createFixture();
    const { articleId, version } = await draft(fixture);
    await saveArticleTranslation(fixture.articles, {
      articleId,
      locale: "zh",
      baseVersion: version,
      title: "Server wins",
    });

    await saveArticleTranslation(fixture.articles, {
      articleId,
      locale: "zh",
      baseVersion: version,
      title: "Local loses",
      bodyJson: '{"type":"doc","content":[{"type":"heading"}]}',
    });

    const stored = await getArticle(fixture.articles, articleId);
    expect(stored?.translations[0]).toMatchObject({
      title: "Server wins",
      bodyJson: DOC,
      version: 2,
    });
  });

  it("refuses a save whose base version is ahead of the server", async () => {
    const fixture = await createFixture();
    const { articleId } = await draft(fixture);

    const outcome = await saveArticleTranslation(fixture.articles, {
      articleId,
      locale: "zh",
      baseVersion: 99,
      title: "From the future",
    });

    expect(outcome).toEqual({
      ok: false,
      reason: "stale-content",
      current: expect.objectContaining({ version: 1, title: "Base" }),
    });
  });

  it("bumps the version when a revision is restored so pending editors cannot overwrite it", async () => {
    const fixture = await createFixture();
    const { articleId, version } = await draft(fixture);
    await publishArticle(fixture.articles, { articleId, publishTime: null });
    const [revision] = await listRevisions(fixture.articles, articleId);
    if (revision === undefined) {
      throw new Error("Publishing should snapshot the Article");
    }
    await saveArticleTranslation(fixture.articles, {
      articleId,
      locale: "zh",
      baseVersion: version,
      title: "Before restore",
    });

    const restored = await restoreRevision(fixture.articles, { articleId, revisionId: revision.id });
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.article.translations[0]).toMatchObject({ title: "Base", version: 3 });

    const stale = await saveArticleTranslation(fixture.articles, {
      articleId,
      locale: "zh",
      baseVersion: 2,
      title: "Before restore",
    });
    expect(stale).toMatchObject({ ok: false, reason: "stale-content" });
  });

  it("does not create a revision snapshot when a stale save is refused", async () => {
    const fixture = await createFixture();
    const { articleId, version } = await draft(fixture);
    await saveArticleTranslation(fixture.articles, { articleId, locale: "zh", baseVersion: version });

    await saveArticleTranslation(fixture.articles, {
      articleId,
      locale: "zh",
      baseVersion: version,
      title: "Local loses",
    });

    await expect(listRevisions(fixture.articles, articleId)).resolves.toEqual([]);
  });
});

describe("publication", () => {
  it("hides a draft from readers", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Invisible", locale: "zh" });

    await expect(
      findReadableArticle(articles, { slug: article.slug, locale: "zh" }),
    ).resolves.toEqual({ kind: "not-found" });
    await expect(listPublishedArticles(articles)).resolves.toEqual([]);
  });

  it("publishes immediately and makes the article visible to readers", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Live", locale: "zh" });

    const outcome = await publishArticle(articles, { articleId: article.id });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.article).toMatchObject({
      publicationState: "published",
      publishTime: "2025-06-15T08:30:00.000Z",
      visibility: "visible",
    });

    const readable = await findReadableArticle(articles, {
      slug: outcome.article.slug,
      locale: "zh",
    });
    expect(readable.kind).toBe("found");
    if (readable.kind !== "found") return;
    expect(readable.translation.locale).toBe("zh");
    expect(readable.indexable).toBe(true);
    expect(readable.fellBack).toBe(false);
  });

  it("keeps a future publish time hidden until the site clock reaches it", async () => {
    const { articles, clock } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Later", locale: "zh" });

    const outcome = await publishArticle(articles, {
      articleId: article.id,
      publishTime: "2025-06-15T09:00:00.000Z",
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.article.visibility).toBe("scheduled");
    expect(outcome.article.publicationState).toBe("published");

    await expect(
      findReadableArticle(articles, { slug: article.slug, locale: "zh" }),
    ).resolves.toEqual({ kind: "not-found" });

    clock.advance(30 * 60 * 1000);

    const readable = await findReadableArticle(articles, { slug: article.slug, locale: "zh" });
    expect(readable.kind).toBe("found");
  });

  it("rejects a publish time that is not an instant", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Later", locale: "zh" });

    await expect(
      publishArticle(articles, { articleId: article.id, publishTime: "next tuesday" }),
    ).resolves.toEqual({ ok: false, reason: "invalid-publish-time" });
  });

  it("lists published articles newest first and leaves drafts out", async () => {
    const { articles, clock } = await createFixture();
    const first = await createArticleDraft(articles, { title: "First", locale: "zh" });
    await publishArticle(articles, { articleId: first.id });
    await createArticleDraft(articles, { title: "Still a draft", locale: "zh" });
    clock.advance(1000);
    const second = await createArticleDraft(articles, { title: "Second", locale: "zh" });
    await publishArticle(articles, { articleId: second.id });

    const listed = await listPublishedArticles(articles);
    expect(listed.map((article) => article.id)).toEqual([second.id, first.id]);
  });

  it("archives a published article: gone from lists, still reachable on its URL", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Old news", locale: "zh" });
    await publishArticle(articles, { articleId: article.id });

    const outcome = await archiveArticle(articles, { articleId: article.id });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.article.visibility).toBe("archived");
    await expect(listPublishedArticles(articles)).resolves.toEqual([]);

    const readable = await findReadableArticle(articles, { slug: article.slug, locale: "zh" });
    expect(readable.kind).toBe("found");
    if (readable.kind !== "found") return;
    expect(readable.indexable).toBe(false);
  });

  it("refuses to archive a draft and unarchives back to published", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Old news", locale: "zh" });

    await expect(archiveArticle(articles, { articleId: article.id })).resolves.toEqual({
      ok: false,
      reason: "not-published",
    });

    await publishArticle(articles, { articleId: article.id });
    await archiveArticle(articles, { articleId: article.id });
    const restored = await unarchiveArticle(articles, { articleId: article.id });

    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.article.visibility).toBe("visible");
  });

  it("permanently deletes an article and leaves its URL answering permanently removed", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Regret", locale: "zh" });
    await publishArticle(articles, { articleId: article.id });

    await expect(deleteArticlePermanently(articles, article.id)).resolves.toEqual({
      deleted: true,
    });

    await expect(resolveArticleSlug(articles, article.slug)).resolves.toEqual({
      kind: "permanently-removed",
    });
    await expect(
      findReadableArticle(articles, { slug: article.slug, locale: "zh" }),
    ).resolves.toEqual({ kind: "permanently-removed" });
    await expect(getArticle(articles, article.id)).resolves.toBeNull();
  });

  it("reports an unknown slug as not found", async () => {
    const { articles } = await createFixture();

    await expect(resolveArticleSlug(articles, "never-existed")).resolves.toEqual({
      kind: "not-found",
    });
  });

  it("serves the default locale content when the requested locale has no version", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Only Chinese", locale: "zh" });
    await publishArticle(articles, { articleId: article.id });

    const readable = await findReadableArticle(articles, { slug: article.slug, locale: "en" });
    expect(readable.kind).toBe("found");
    if (readable.kind !== "found") return;
    expect(readable.translation.locale).toBe("zh");
    expect(readable.fellBack).toBe(true);
  });
});

describe("slugs", () => {
  it("keeps every previous slug resolving to the same article after a rename", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Original Title", locale: "zh" });
    await publishArticle(articles, { articleId: article.id });

    const renamed = await updateArticleMeta(articles, {
      articleId: article.id,
      slug: "renamed-title",
    });
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    expect(renamed.article.slug).toBe("renamed-title");

    for (const slug of ["original-title", "renamed-title"]) {
      const resolved = await resolveArticleSlug(articles, slug);
      expect(resolved.kind).toBe("found");
      if (resolved.kind !== "found") return;
      expect(resolved.article.id).toBe(article.id);
    }

    const old = await resolveArticleSlug(articles, "original-title");
    expect(old.kind === "found" && old.slugKind).toBe("historical");
    const current = await resolveArticleSlug(articles, "renamed-title");
    expect(current.kind === "found" && current.slugKind).toBe("current");
  });

  it("rejects a slug that already belongs to another article", async () => {
    const { articles } = await createFixture();
    const first = await createArticleDraft(articles, { title: "First", locale: "zh" });
    const second = await createArticleDraft(articles, { title: "Second", locale: "zh" });

    await expect(
      updateArticleMeta(articles, { articleId: second.id, slug: first.slug }),
    ).resolves.toEqual({ ok: false, reason: "duplicate-slug" });
  });

  it("rejects a slug that normalises to nothing", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "First", locale: "zh" });

    await expect(
      updateArticleMeta(articles, { articleId: article.id, slug: "!!!" }),
    ).resolves.toEqual({ ok: false, reason: "invalid-slug" });
  });

  it("normalises a slug typed with capitals and spaces", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "First", locale: "zh" });

    const outcome = await updateArticleMeta(articles, {
      articleId: article.id,
      slug: "My New Slug",
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.article.slug).toBe("my-new-slug");
  });
});

describe("revisions", () => {
  it("writes one publish snapshot per translation on every publish", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Two locales", locale: "zh" });
    await addArticleTranslation(articles, { articleId: article.id, locale: "en", title: "Two" });

    await publishArticle(articles, { articleId: article.id });

    const revisions = await listRevisions(articles, article.id);
    expect(revisions).toHaveLength(2);
    expect(revisions.map((revision) => revision.kind)).toEqual(["publish", "publish"]);
    expect(revisions.map((revision) => revision.locale).sort()).toEqual(["en", "zh"]);
    expect(revisions[0]?.bodyJson).toBeDefined();
  });

  it("snapshots the content that was current at publish time", async () => {
    const { articles, clock } = await createFixture();
    const article = await createArticleDraft(articles, {
      title: "Before",
      locale: "zh",
      bodyJson: DOC,
    });
    await publishArticle(articles, { articleId: article.id });

    clock.advance(1000);
    await saveArticleTranslation(articles, {
      articleId: article.id,
      locale: "zh",
      baseVersion: article.translations[0].version,
      title: "After",
      bodyJson: DOC,
    });

    const revisions = await listRevisions(articles, article.id);
    expect(revisions[0]).toMatchObject({ title: "Before", kind: "publish" });
  });

  it("throttles automatic edit snapshots", async () => {
    const { articles, clock } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Throttled", locale: "zh" });

    const first = await captureAutomaticRevision(articles, { articleId: article.id });
    expect(first).toMatchObject({ ok: true, created: true });

    clock.advance(60 * 1000);
    const second = await captureAutomaticRevision(articles, { articleId: article.id });
    expect(second).toEqual({ ok: true, created: false });

    clock.advance(10 * 60 * 1000);
    const third = await captureAutomaticRevision(articles, { articleId: article.id });
    expect(third).toMatchObject({ ok: true, created: true });
  });

  it("prunes automatic snapshots to the latest N while keeping every publish snapshot", async () => {
    const { articles, clock } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Many", locale: "zh" });
    await publishArticle(articles, { articleId: article.id });

    for (let index = 0; index < 24; index += 1) {
      clock.advance(11 * 60 * 1000);
      await captureAutomaticRevision(articles, { articleId: article.id });
    }

    const revisions = await listRevisions(articles, article.id);
    expect(revisions.filter((revision) => revision.kind === "publish")).toHaveLength(1);
    expect(revisions.filter((revision) => revision.kind === "automatic")).toHaveLength(20);
  });

  it("restores a revision back into the translation", async () => {
    const { articles, clock } = await createFixture();
    const article = await createArticleDraft(articles, {
      title: "First title",
      locale: "zh",
      bodyJson: DOC,
    });
    await publishArticle(articles, { articleId: article.id });
    const [snapshot] = await listRevisions(articles, article.id);
    expect(snapshot).toBeDefined();
    if (snapshot === undefined) return;

    clock.advance(1000);
    await saveArticleTranslation(articles, {
      articleId: article.id,
      locale: "zh",
      baseVersion: article.translations[0].version,
      title: "Second title",
      bodyJson: '{"type":"doc","content":[{"type":"paragraph","text":"changed"}]}',
    });

    const outcome = await restoreRevision(articles, {
      articleId: article.id,
      revisionId: snapshot.id,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.article.translations[0]).toMatchObject({ title: "First title" });
  });
});

describe("category and tags on an article", () => {
  it("assigns one category and several tags", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Filed", locale: "zh" });
    const category = await createCategory(articles, {
      slug: "tech",
      locale: "zh",
      name: "技术",
    });
    const tagA = await createTag(articles, { locale: "zh", name: "TypeScript" });
    const tagB = await createTag(articles, { locale: "zh", name: "SQLite" });
    expect(category.ok && tagA.ok && tagB.ok).toBe(true);
    if (!category.ok || !tagA.ok || !tagB.ok) return;

    const outcome = await updateArticleMeta(articles, {
      articleId: article.id,
      categoryId: category.category.id,
      tagIds: [tagA.tag.id, tagB.tag.id],
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.article.categoryId).toBe(category.category.id);
    expect(outcome.article.category).toMatchObject({ slug: "tech", names: { zh: "技术" } });
    expect(outcome.article.tags.map((tag) => tag.slug).sort()).toEqual(["sqlite", "typescript"]);
  });

  it("rejects a category that does not exist", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Filed", locale: "zh" });

    await expect(
      updateArticleMeta(articles, { articleId: article.id, categoryId: randomUUID() }),
    ).resolves.toEqual({ ok: false, reason: "unknown-category" });
  });

  it("returns unknown tags as a failure", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Filed", locale: "zh" });

    await expect(
      updateArticleMeta(articles, { articleId: article.id, tagIds: [randomUUID()] }),
    ).resolves.toEqual({ ok: false, reason: "unknown-tag" });
  });

  it("clears the category and tags", async () => {
    const { articles } = await createFixture();
    const article = await createArticleDraft(articles, { title: "Filed", locale: "zh" });

    const outcome = await updateArticleMeta(articles, {
      articleId: article.id,
      categoryId: null,
      tagIds: [],
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.article.categoryId).toBeNull();
    expect(outcome.article.tags).toEqual([]);
  });
});
