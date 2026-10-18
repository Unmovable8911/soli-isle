import { afterEach, describe, expect, it } from "vitest";

import { createArticleContext, type ArticleContext } from "@/services/articles";
import { createAssetContext } from "@/services/assets";
import { createCategory, createCategoryContext, listCategoryTree } from "@/services/categories";
import { createTestHarness, type TestHarness } from "@/test/harness";

const harnesses: TestHarness[] = [];

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

describe("category tree", () => {
  it("creates a root category with a locale-neutral slug path", async () => {
    const { articles } = await createFixture();

    const outcome = await createCategory(articles, { locale: "zh", name: "技术" });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.category).toMatchObject({
      parentId: null,
      slug: "技术",
      path: "技术",
      position: 0,
      names: { zh: "技术" },
    });
  });

  it("derives the slug from the name and keeps an explicit slug when given", async () => {
    const { articles } = await createFixture();

    const derived = await createCategory(articles, { locale: "zh", name: "Front End" });
    const explicit = await createCategory(articles, { locale: "zh", name: "前端", slug: "frontend" });

    expect(derived.ok && derived.category.slug).toBe("front-end");
    expect(explicit.ok && explicit.category.slug).toBe("frontend");
  });

  it("nests a child under its parent and builds the path from the ancestors", async () => {
    const { articles } = await createFixture();
    const parent = await createCategory(articles, { locale: "zh", name: "tech" });
    expect(parent.ok).toBe(true);
    if (!parent.ok) return;

    const child = await createCategory(articles, {
      parentId: parent.category.id,
      locale: "zh",
      name: "frontend",
    });

    expect(child.ok).toBe(true);
    if (!child.ok) return;
    expect(child.category).toMatchObject({ parentId: parent.category.id, path: "tech/frontend" });
  });

  it("rejects a second category on the same path", async () => {
    const { articles } = await createFixture();
    await createCategory(articles, { locale: "zh", name: "tech" });

    await expect(createCategory(articles, { locale: "en", name: "tech" })).resolves.toEqual({
      ok: false,
      reason: "duplicate-slug",
    });
  });

  it("rejects a category under an unknown parent", async () => {
    const { articles } = await createFixture();

    await expect(
      createCategory(articles, {
        parentId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        locale: "zh",
        name: "orphan",
      }),
    ).resolves.toEqual({ ok: false, reason: "unknown-parent" });
  });

  it("rejects a category without a name", async () => {
    const { articles } = await createFixture();

    await expect(createCategory(articles, { locale: "zh", name: "   " })).resolves.toEqual({
      ok: false,
      reason: "invalid-name",
    });
  });

  it("returns the tree with children ordered by position", async () => {
    const { articles } = await createFixture();
    const root = await createCategory(articles, { locale: "zh", name: "tech" });
    expect(root.ok).toBe(true);
    if (!root.ok) return;
    const first = await createCategory(articles, {
      parentId: root.category.id,
      locale: "zh",
      name: "alpha",
    });
    const second = await createCategory(articles, {
      parentId: root.category.id,
      locale: "en",
      name: "beta",
    });
    expect(first.ok && second.ok).toBe(true);

    const tree = await listCategoryTree(createCategoryContext(articles.database, articles.clock));

    expect(tree).toHaveLength(1);
    expect(tree[0]?.children.map((node) => node.path)).toEqual(["tech/alpha", "tech/beta"]);
    expect(tree[0]?.children[1]?.names).toEqual({ en: "beta" });
  });

  it("returns an empty tree when no category exists", async () => {
    const { articles } = await createFixture();

    await expect(
      listCategoryTree(createCategoryContext(articles.database, articles.clock)),
    ).resolves.toEqual([]);
  });
});
