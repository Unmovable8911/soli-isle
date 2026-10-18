import { afterEach, describe, expect, it } from "vitest";

import {
  createArticleContext,
  createArticleDraft,
  getArticle,
  updateArticleMeta,
  type ArticleContext,
} from "@/services/articles";
import { createAssetContext } from "@/services/assets";
import { createPostDraft, setPostTags } from "@/services/posts";
import { createTag, createTagContext, deleteTag, listTags, setTagName } from "@/services/tags";
import { createTestHarness, type TestHarness } from "@/test/harness";

const harnesses: TestHarness[] = [];

const EMPTY_DOC = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

async function createFixture(): Promise<{ harness: TestHarness; articles: ArticleContext }> {
  const harness = await createTestHarness();
  harnesses.push(harness);
  const assets = createAssetContext(harness.database, harness.clock, harness.resources.rootDir);
  return {
    harness,
    articles: createArticleContext(harness.database, harness.clock, assets),
  };
}

afterEach(async () => {
  for (const harness of harnesses.splice(0)) {
    await harness.close();
  }
});

describe("tags", () => {
  it("creates a tag with a slug derived from its name", async () => {
    const { articles } = await createFixture();

    const outcome = await createTag(articles, { locale: "zh", name: "Type Script" });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.tag).toMatchObject({ slug: "type-script", names: { zh: "Type Script" } });
  });

  it("adds a second locale name to an existing tag slug", async () => {
    const { articles } = await createFixture();
    const created = await createTag(articles, { locale: "zh", name: "技术" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const same = await createTag(articles, {
      slug: created.tag.slug,
      locale: "en",
      name: "Tech",
    });

    expect(same.ok).toBe(true);
    if (!same.ok) return;
    expect(same.tag.names).toEqual({ zh: "技术", en: "Tech" });
  });

  it("rejects a tag without a name", async () => {
    const { articles } = await createFixture();

    await expect(createTag(articles, { locale: "zh", name: " " })).resolves.toEqual({
      ok: false,
      reason: "invalid-name",
    });
  });

  it("lists tags alphabetically", async () => {
    const { articles } = await createFixture();
    await createTag(articles, { locale: "zh", name: "beta" });
    await createTag(articles, { locale: "zh", name: "alpha" });

    const tags = await listTags(createTagContext(articles.database, articles.clock));

    expect(tags.map((tag) => tag.slug)).toEqual(["alpha", "beta"]);
  });
});

describe("tag display names", () => {
  it("adds and replaces a name per Locale without touching the slug", async () => {
    const { articles } = await createFixture();
    const created = await createTag(articles, { locale: "zh", name: "编辑器" });
    if (!created.ok) throw new Error("fixture");

    await expect(
      setTagName(articles, { tagId: created.tag.id, locale: "en", name: "Editor" }),
    ).resolves.toEqual({
      ok: true,
      tag: { id: created.tag.id, slug: "编辑器", names: { zh: "编辑器", en: "Editor" } },
    });

    await expect(
      setTagName(articles, { tagId: created.tag.id, locale: "en", name: "Editors" }),
    ).resolves.toMatchObject({ tag: { names: { zh: "编辑器", en: "Editors" } } });
    await expect(listTags(articles)).resolves.toEqual([
      { id: created.tag.id, slug: "编辑器", names: { zh: "编辑器", en: "Editors" } },
    ]);
  });

  it("refuses a blank name and an unknown tag", async () => {
    const { articles } = await createFixture();
    const created = await createTag(articles, { locale: "zh", name: "编辑器" });
    if (!created.ok) throw new Error("fixture");

    await expect(
      setTagName(articles, { tagId: created.tag.id, locale: "en", name: "  " }),
    ).resolves.toEqual({ ok: false, reason: "invalid-name" });
    await expect(
      setTagName(articles, { tagId: "01ZZZZ", locale: "en", name: "Nope" }),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
  });
});

describe("deleting a tag", () => {
  it("deletes a tag nothing uses", async () => {
    const { articles } = await createFixture();
    const created = await createTag(articles, { locale: "zh", name: "闲置" });
    if (!created.ok) throw new Error("fixture");

    await expect(deleteTag(articles, { tagId: created.tag.id })).resolves.toEqual({ ok: true });
    await expect(listTags(articles)).resolves.toEqual([]);
  });

  it("refuses while an Article uses it, and says how many", async () => {
    const { articles } = await createFixture();
    const created = await createTag(articles, { locale: "zh", name: "编辑器" });
    if (!created.ok) throw new Error("fixture");
    const draft = await createArticleDraft(articles, { title: "one" });
    await updateArticleMeta(articles, { articleId: draft.id, tagIds: [created.tag.id] });

    await expect(deleteTag(articles, { tagId: created.tag.id })).resolves.toEqual({
      ok: false,
      reason: "in-use",
      articleCount: 1,
      postCount: 0,
    });
    // Refusing is not a silent detach: the Article keeps its Tag.
    await expect(getArticle(articles, draft.id)).resolves.toMatchObject({
      tags: [{ id: created.tag.id }],
    });
  });

  it("refuses while a Post uses it, and says how many", async () => {
    const { articles } = await createFixture();
    const created = await createTag(articles, { locale: "zh", name: "编辑器" });
    if (!created.ok) throw new Error("fixture");
    const post = await createPostDraft(articles, { bodyJson: EMPTY_DOC });
    await setPostTags(articles, { postId: post.id, tagIds: [created.tag.id] });

    await expect(deleteTag(articles, { tagId: created.tag.id })).resolves.toEqual({
      ok: false,
      reason: "in-use",
      articleCount: 0,
      postCount: 1,
    });
  });

  it("reports both kinds of use at once and refuses an unknown tag", async () => {
    const { articles } = await createFixture();
    const created = await createTag(articles, { locale: "zh", name: "编辑器" });
    if (!created.ok) throw new Error("fixture");
    const draft = await createArticleDraft(articles, { title: "one" });
    await updateArticleMeta(articles, { articleId: draft.id, tagIds: [created.tag.id] });
    const post = await createPostDraft(articles, { bodyJson: EMPTY_DOC });
    await setPostTags(articles, { postId: post.id, tagIds: [created.tag.id] });

    await expect(deleteTag(articles, { tagId: created.tag.id })).resolves.toEqual({
      ok: false,
      reason: "in-use",
      articleCount: 1,
      postCount: 1,
    });
    await expect(deleteTag(articles, { tagId: "01ZZZZ" })).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
  });
});
