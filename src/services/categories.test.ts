import { afterEach, describe, expect, it } from "vitest";

import {
  createArticleContext,
  createArticleDraft,
  getArticle,
  updateArticleMeta,
  type ArticleContext,
} from "@/services/articles";
import { createAssetContext } from "@/services/assets";
import {
  createCategory,
  createCategoryContext,
  deleteCategory,
  listCategoryTree,
  moveCategory,
  reorderCategory,
  setCategoryName,
} from "@/services/categories";
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

describe("category display names", () => {
  it("adds a name in another Locale without touching the slug, the path or the parent", async () => {
    const { articles } = await createFixture();
    const parent = await createCategory(articles, { locale: "zh", name: "技术" });
    if (!parent.ok) throw new Error("fixture");

    const outcome = await setCategoryName(articles, {
      categoryId: parent.category.id,
      locale: "en",
      name: "Engineering",
    });

    expect(outcome).toEqual({
      ok: true,
      category: {
        id: parent.category.id,
        parentId: null,
        slug: "技术",
        path: "技术",
        position: 0,
        names: { zh: "技术", en: "Engineering" },
      },
    });
    // A display name is per Locale: the Locale-neutral Slug path is untouched.
    await expect(listCategoryTree(articles)).resolves.toMatchObject([
      { path: "技术", slug: "技术", names: { zh: "技术", en: "Engineering" } },
    ]);
  });

  it("replaces the existing name for the Locale it was given", async () => {
    const { articles } = await createFixture();
    const created = await createCategory(articles, { locale: "zh", name: "技术" });
    if (!created.ok) throw new Error("fixture");

    await setCategoryName(articles, { categoryId: created.category.id, locale: "zh", name: "工程" });

    const tree = await listCategoryTree(articles);
    expect(tree[0]?.names).toEqual({ zh: "工程" });
    expect(tree[0]?.path).toBe("技术");
  });

  it("refuses a blank name and an unknown category", async () => {
    const { articles } = await createFixture();
    const created = await createCategory(articles, { locale: "zh", name: "技术" });
    if (!created.ok) throw new Error("fixture");

    await expect(
      setCategoryName(articles, { categoryId: created.category.id, locale: "en", name: "   " }),
    ).resolves.toEqual({ ok: false, reason: "invalid-name" });
    await expect(
      setCategoryName(articles, { categoryId: "01ZZZZ", locale: "en", name: "Nope" }),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
  });
});

describe("moving a category", () => {
  it("rewrites its path and every descendant's path under the new parent", async () => {
    const { articles } = await createFixture();
    const notes = await createCategory(articles, { locale: "zh", name: "notes" });
    const essays = await createCategory(articles, { locale: "zh", name: "essays" });
    if (!notes.ok || !essays.ok) throw new Error("fixture");
    const tools = await createCategory(articles, {
      locale: "zh",
      name: "tools",
      parentId: notes.category.id,
    });
    if (!tools.ok) throw new Error("fixture");
    await createCategory(articles, { locale: "zh", name: "editor", parentId: tools.category.id });

    const outcome = await moveCategory(articles, {
      categoryId: tools.category.id,
      parentId: essays.category.id,
    });

    expect(outcome).toMatchObject({ ok: true, category: { path: "essays/tools", position: 0 } });
    const tree = await listCategoryTree(articles);
    expect(tree.map((node) => node.path)).toEqual(["notes", "essays"]);
    expect(tree[1]?.children.map((node) => node.path)).toEqual(["essays/tools"]);
    expect(tree[1]?.children[0]?.children.map((node) => node.path)).toEqual([
      "essays/tools/editor",
    ]);
  });

  it("moves a category to the root, rebuilding its path from its own slug", async () => {
    const { articles } = await createFixture();
    const notes = await createCategory(articles, { locale: "zh", name: "notes" });
    if (!notes.ok) throw new Error("fixture");
    const tools = await createCategory(articles, {
      locale: "zh",
      name: "tools",
      parentId: notes.category.id,
    });
    if (!tools.ok) throw new Error("fixture");

    const outcome = await moveCategory(articles, {
      categoryId: tools.category.id,
      parentId: null,
    });

    expect(outcome).toMatchObject({ ok: true, category: { parentId: null, path: "tools" } });
  });

  it("appends at the end of the new parent's children", async () => {
    const { articles } = await createFixture();
    const host = await createCategory(articles, { locale: "zh", name: "host" });
    const loose = await createCategory(articles, { locale: "zh", name: "loose" });
    if (!host.ok || !loose.ok) throw new Error("fixture");
    await createCategory(articles, { locale: "zh", name: "first", parentId: host.category.id });

    const outcome = await moveCategory(articles, {
      categoryId: loose.category.id,
      parentId: host.category.id,
    });

    expect(outcome).toMatchObject({ ok: true, category: { path: "host/loose", position: 1 } });
  });

  it("refuses to move a category into itself or into its own descendant", async () => {
    const { articles } = await createFixture();
    const notes = await createCategory(articles, { locale: "zh", name: "notes" });
    if (!notes.ok) throw new Error("fixture");
    const tools = await createCategory(articles, {
      locale: "zh",
      name: "tools",
      parentId: notes.category.id,
    });
    if (!tools.ok) throw new Error("fixture");

    await expect(
      moveCategory(articles, { categoryId: notes.category.id, parentId: notes.category.id }),
    ).resolves.toEqual({ ok: false, reason: "cyclic-move" });
    await expect(
      moveCategory(articles, { categoryId: notes.category.id, parentId: tools.category.id }),
    ).resolves.toEqual({ ok: false, reason: "cyclic-move" });
  });

  it("refuses a move that would collide with a sibling's slug path", async () => {
    const { articles } = await createFixture();
    const left = await createCategory(articles, { locale: "zh", name: "left" });
    const right = await createCategory(articles, { locale: "zh", name: "right" });
    if (!left.ok || !right.ok) throw new Error("fixture");
    await createCategory(articles, { locale: "zh", name: "tools", parentId: left.category.id });
    const moving = await createCategory(articles, {
      locale: "zh",
      name: "tools",
      parentId: right.category.id,
    });
    if (!moving.ok) throw new Error("fixture");

    await expect(
      moveCategory(articles, { categoryId: moving.category.id, parentId: left.category.id }),
    ).resolves.toEqual({ ok: false, reason: "duplicate-slug" });
    // Nothing moved.
    const tree = await listCategoryTree(articles);
    expect(tree[1]?.children[0]?.path).toBe("right/tools");
  });

  it("refuses an unknown category and an unknown parent", async () => {
    const { articles } = await createFixture();
    const notes = await createCategory(articles, { locale: "zh", name: "notes" });
    if (!notes.ok) throw new Error("fixture");

    await expect(
      moveCategory(articles, { categoryId: "01ZZZZ", parentId: null }),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
    await expect(
      moveCategory(articles, { categoryId: notes.category.id, parentId: "01ZZZZ" }),
    ).resolves.toEqual({ ok: false, reason: "unknown-parent" });
  });
});

describe("reordering categories", () => {
  it("swaps a category with the sibling above it and rewrites positions 0..n-1", async () => {
    const { articles } = await createFixture();
    await createCategory(articles, { locale: "zh", name: "one" });
    const two = await createCategory(articles, { locale: "zh", name: "two" });
    const three = await createCategory(articles, { locale: "zh", name: "three" });
    if (!two.ok || !three.ok) throw new Error("fixture");

    const outcome = await reorderCategory(articles, {
      categoryId: three.category.id,
      direction: "up",
    });

    expect(outcome).toMatchObject({ ok: true, category: { path: "three", position: 1 } });
    const tree = await listCategoryTree(articles);
    expect(tree.map((node) => [node.path, node.position])).toEqual([
      ["one", 0],
      ["three", 1],
      ["two", 2],
    ]);
  });

  it("only reorders among siblings that share a parent", async () => {
    const { articles } = await createFixture();
    const host = await createCategory(articles, { locale: "zh", name: "host" });
    if (!host.ok) throw new Error("fixture");
    await createCategory(articles, { locale: "zh", name: "outer" });
    const inner = await createCategory(articles, {
      locale: "zh",
      name: "inner",
      parentId: host.category.id,
    });
    if (!inner.ok) throw new Error("fixture");

    // `inner` is the only child of `host`: at both ends, nothing moves.
    await expect(
      reorderCategory(articles, { categoryId: inner.category.id, direction: "up" }),
    ).resolves.toEqual({ ok: false, reason: "no-sibling" });
    const tree = await listCategoryTree(articles);
    expect(tree.map((node) => node.path)).toEqual(["host", "outer"]);
  });

  it("refuses to move the last sibling down and the first up", async () => {
    const { articles } = await createFixture();
    const one = await createCategory(articles, { locale: "zh", name: "one" });
    const two = await createCategory(articles, { locale: "zh", name: "two" });
    if (!one.ok || !two.ok) throw new Error("fixture");

    await expect(
      reorderCategory(articles, { categoryId: one.category.id, direction: "up" }),
    ).resolves.toEqual({ ok: false, reason: "no-sibling" });
    await expect(
      reorderCategory(articles, { categoryId: two.category.id, direction: "down" }),
    ).resolves.toEqual({ ok: false, reason: "no-sibling" });
    await expect(
      reorderCategory(articles, { categoryId: "01ZZZZ", direction: "up" }),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
  });
});

describe("deleting a category", () => {
  it("deletes a category nothing uses", async () => {
    const { articles } = await createFixture();
    const notes = await createCategory(articles, { locale: "zh", name: "notes" });
    if (!notes.ok) throw new Error("fixture");

    await expect(deleteCategory(articles, { categoryId: notes.category.id })).resolves.toEqual({
      ok: true,
      movedArticles: 0,
    });
    await expect(listCategoryTree(articles)).resolves.toEqual([]);
  });

  it("refuses while the category still has child categories, and says how many", async () => {
    const { articles } = await createFixture();
    const notes = await createCategory(articles, { locale: "zh", name: "notes" });
    if (!notes.ok) throw new Error("fixture");
    await createCategory(articles, { locale: "zh", name: "a", parentId: notes.category.id });
    await createCategory(articles, { locale: "zh", name: "b", parentId: notes.category.id });

    await expect(deleteCategory(articles, { categoryId: notes.category.id })).resolves.toEqual({
      ok: false,
      reason: "has-children",
      childCount: 2,
    });
    expect((await listCategoryTree(articles)).length).toBe(1);
  });

  it("refuses while Articles use it, and says how many", async () => {
    const { articles } = await createFixture();
    const notes = await createCategory(articles, { locale: "zh", name: "notes" });
    if (!notes.ok) throw new Error("fixture");
    for (const title of ["one", "two"]) {
      const draft = await createArticleDraft(articles, { title });
      await updateArticleMeta(articles, { articleId: draft.id, categoryId: notes.category.id });
    }

    await expect(deleteCategory(articles, { categoryId: notes.category.id })).resolves.toEqual({
      ok: false,
      reason: "in-use",
      articleCount: 2,
    });
    // The refusal is not a silent detach: the Articles keep their Category.
    const tree = await listCategoryTree(articles);
    expect(tree.map((node) => node.path)).toEqual(["notes"]);
  });

  it("moves the Articles to the Category the Author named, then deletes it", async () => {
    const { articles } = await createFixture();
    const notes = await createCategory(articles, { locale: "zh", name: "notes" });
    const essays = await createCategory(articles, { locale: "zh", name: "essays" });
    if (!notes.ok || !essays.ok) throw new Error("fixture");
    const draft = await createArticleDraft(articles, { title: "one" });
    await updateArticleMeta(articles, { articleId: draft.id, categoryId: notes.category.id });

    const outcome = await deleteCategory(articles, {
      categoryId: notes.category.id,
      moveArticlesTo: essays.category.id,
    });

    expect(outcome).toEqual({ ok: true, movedArticles: 1 });
    await expect(getArticle(articles, draft.id)).resolves.toMatchObject({
      category: { id: essays.category.id, path: "essays" },
    });
  });

  it("refuses a destination that does not exist and a destination that is itself", async () => {
    const { articles } = await createFixture();
    const notes = await createCategory(articles, { locale: "zh", name: "notes" });
    if (!notes.ok) throw new Error("fixture");
    const draft = await createArticleDraft(articles, { title: "one" });
    await updateArticleMeta(articles, { articleId: draft.id, categoryId: notes.category.id });

    await expect(
      deleteCategory(articles, { categoryId: notes.category.id, moveArticlesTo: "01ZZZZ" }),
    ).resolves.toEqual({ ok: false, reason: "unknown-destination" });
    await expect(
      deleteCategory(articles, {
        categoryId: notes.category.id,
        moveArticlesTo: notes.category.id,
      }),
    ).resolves.toEqual({ ok: false, reason: "unknown-destination" });
    await expect(
      deleteCategory(articles, { categoryId: "01ZZZZ" }),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
  });
});

describe("category path uniqueness", () => {
  it("is enforced by the database, not only by the service", async () => {
    const { harness, articles } = await createFixture();
    const notes = await createCategory(articles, { locale: "zh", name: "notes" });
    if (!notes.ok) throw new Error("fixture");

    const index = harness.database.sqlite
      .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get("category_path_idx");
    expect(index).toMatchObject({
      sql: expect.stringContaining("CREATE UNIQUE INDEX") as unknown as string,
    });

    expect(() =>
      harness.database.sqlite
        .prepare(
          "INSERT INTO category (id, parent_id, slug, path, position, created_at) VALUES (?, NULL, ?, ?, 1, ?)",
        )
        .run("01ZZZZ", "notes", "notes", "2025-06-15T08:30:00.000Z"),
    ).toThrow(/UNIQUE constraint failed/);
  });
});
