import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { resolveAuthConfig } from "@/config/auth";
import { insertAuthorSession } from "@/db/auth-repository";
import {
  createArticleContext,
  createArticleDraft,
  updateArticleMeta,
  type ArticleContext,
} from "@/services/articles";
import { createAssetContext } from "@/services/assets";
import { createAuthorAuthContext, type AuthorAuthContext } from "@/services/auth";
import { createCategory, listCategoryTree } from "@/services/categories";
import { createTag } from "@/services/tags";
import { createTestHarness, type TestHarness } from "@/test/harness";

import {
  deleteCategoryResponse,
  deleteTagResponse,
  updateCategoryResponse,
  updateTagResponse,
} from "./catalogue";

interface Fixture {
  harness: TestHarness;
  articles: ArticleContext;
  auth: AuthorAuthContext;
  cookie: string;
}

const fixtures: Fixture[] = [];

async function createFixture(): Promise<Fixture> {
  const harness = await createTestHarness();
  const auth = createAuthorAuthContext(harness.database, harness.clock, resolveAuthConfig(), null);
  const sessionId = randomUUID();
  const now = harness.clock.now();
  insertAuthorSession(harness.database.db, {
    id: sessionId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  });
  const fixture: Fixture = {
    harness,
    articles: createArticleContext(
      harness.database,
      harness.clock,
      createAssetContext(harness.database, harness.clock, harness.resources.rootDir),
    ),
    auth,
    cookie: `soli-session=${sessionId}`,
  };
  fixtures.push(fixture);
  return fixture;
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await fixture.harness.close();
  }
});

function request(path: string, init: RequestInit & { cookie?: string } = {}): Request {
  const { cookie, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (cookie !== undefined) {
    headers.set("cookie", cookie);
  }
  return new Request(`http://localhost${path}`, { ...rest, headers });
}

function patch(path: string, body: unknown, cookie?: string): Request {
  return request(path, {
    method: "PATCH",
    cookie,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function category(articles: ArticleContext, name: string, parentId?: string): Promise<string> {
  const outcome = await createCategory(
    articles,
    parentId === undefined ? { locale: "zh", name } : { locale: "zh", name, parentId },
  );
  if (!outcome.ok) throw new Error("fixture");
  return outcome.category.id;
}

describe("catalogue endpoint authorization", () => {
  it("rejects every write without a session", async () => {
    const { articles, auth } = await createFixture();

    for (const response of await Promise.all([
      updateCategoryResponse(articles, auth, patch("/api/admin/categories/x", {}), "x"),
      deleteCategoryResponse(articles, auth, request("/api/admin/categories/x"), "x"),
      updateTagResponse(articles, auth, patch("/api/admin/tags/x", {}), "x"),
      deleteTagResponse(articles, auth, request("/api/admin/tags/x"), "x"),
    ])) {
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    }
  });
});

describe("category endpoint", () => {
  it("adds a display name in a Locale and answers the whole tree", async () => {
    const { articles, auth, cookie } = await createFixture();
    const notes = await category(articles, "notes");

    const response = await updateCategoryResponse(
      articles,
      auth,
      patch("/api/admin/categories/" + notes, { action: "rename", locale: "en", name: "Notes" }, cookie),
      notes,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      categories: [
        { id: notes, parentId: null, slug: "notes", path: "notes", position: 0, names: { zh: "notes", en: "Notes" }, children: [] },
      ],
    });
  });

  it("moves a Category under another and answers the rebuilt paths", async () => {
    const { articles, auth, cookie } = await createFixture();
    const host = await category(articles, "host");
    const loose = await category(articles, "loose");

    const response = await updateCategoryResponse(
      articles,
      auth,
      patch(`/api/admin/categories/${loose}`, { action: "move", parentId: host }, cookie),
      loose,
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { categories: { path: string }[] };
    expect(payload.categories[0]?.path).toBe("host");
    await expect(listCategoryTree(articles)).resolves.toMatchObject([
      { path: "host", children: [{ path: "host/loose" }] },
    ]);
  });

  it("moves a Category to the root when parentId is null", async () => {
    const { articles, auth, cookie } = await createFixture();
    const host = await category(articles, "host");
    const inner = await category(articles, "inner", host);

    const response = await updateCategoryResponse(
      articles,
      auth,
      patch(`/api/admin/categories/${inner}`, { action: "move", parentId: null }, cookie),
      inner,
    );

    expect(response.status).toBe(200);
    await expect(listCategoryTree(articles)).resolves.toMatchObject([
      { path: "host", children: [] },
      { path: "inner", parentId: null },
    ]);
  });

  it("reorders among siblings and refuses at the end of the list", async () => {
    const { articles, auth, cookie } = await createFixture();
    await category(articles, "one");
    const two = await category(articles, "two");

    const response = await updateCategoryResponse(
      articles,
      auth,
      patch(`/api/admin/categories/${two}`, { action: "reorder", direction: "up" }, cookie),
      two,
    );
    expect(response.status).toBe(200);
    const tree = await listCategoryTree(articles);
    expect(tree.map((node) => [node.path, node.position])).toEqual([
      ["two", 0],
      ["one", 1],
    ]);

    const refused = await updateCategoryResponse(
      articles,
      auth,
      patch("/api/admin/categories/" + two, { action: "reorder", direction: "up" }, cookie),
      two,
    );
    expect(refused.status).toBe(409);
    await expect(refused.json()).resolves.toEqual({ error: "no-sibling" });
  });

  it("maps every refusal to a status code", async () => {
    const { articles, auth, cookie } = await createFixture();
    const host = await category(articles, "host");
    const inner = await category(articles, "inner", host);

    const cases: [Request, number, string][] = [
      [patch("/api/admin/categories/" + host, { action: "rename", locale: "en", name: " " }, cookie), 400, "invalid-name"],
      [patch("/api/admin/categories/" + host, { action: "move", parentId: inner }, cookie), 409, "cyclic-move"],
      [patch("/api/admin/categories/" + host, { action: "move", parentId: "01ZZZZ" }, cookie), 400, "unknown-parent"],
      [patch("/api/admin/categories/" + host, { action: "reorder", direction: "up" }, cookie), 409, "no-sibling"],
      [patch("/api/admin/categories/" + host, { action: "explode" }, cookie), 400, "invalid-action"],
      [patch("/api/admin/categories/" + host, { action: "rename", locale: "zz", name: "x" }, cookie), 400, "invalid-locale"],
    ];

    for (const [request_, status, error] of cases) {
      const response = await updateCategoryResponse(articles, auth, request_, host);
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ error });
    }

    const missing = await updateCategoryResponse(
      articles,
      auth,
      patch("/api/admin/categories/01ZZZZ", { action: "rename", locale: "en", name: "x" }, cookie),
      "01ZZZZ",
    );
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: "not-found" });
  });

  it("refuses a delete that would orphan Articles, then moves them where told", async () => {
    const { articles, auth, cookie } = await createFixture();
    const notes = await category(articles, "notes");
    const essays = await category(articles, "essays");
    const draft = await createArticleDraft(articles, { title: "one" });
    await updateArticleMeta(articles, { articleId: draft.id, categoryId: notes });

    const refused = await deleteCategoryResponse(
      articles,
      auth,
      request(`/api/admin/categories/${notes}`, { method: "DELETE", cookie }),
      notes,
    );
    expect(refused.status).toBe(409);
    await expect(refused.json()).resolves.toEqual({ error: "in-use", articleCount: 1 });

    const moved = await deleteCategoryResponse(
      articles,
      auth,
      request(`/api/admin/categories/${notes}?moveArticlesTo=${essays}`, {
        method: "DELETE",
        cookie,
      }),
      notes,
    );
    expect(moved.status).toBe(200);
    await expect(moved.json()).resolves.toEqual({ movedArticles: 1 });
  });

  it("refuses a delete that still has child Categories", async () => {
    const { articles, auth, cookie } = await createFixture();
    const host = await category(articles, "host");
    await category(articles, "inner", host);

    const response = await deleteCategoryResponse(
      articles,
      auth,
      request(`/api/admin/categories/${host}`, { method: "DELETE", cookie }),
      host,
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "has-children", childCount: 1 });
  });

  it("deletes an unused Category", async () => {
    const { articles, auth, cookie } = await createFixture();
    const notes = await category(articles, "notes");

    const response = await deleteCategoryResponse(
      articles,
      auth,
      request(`/api/admin/categories/${notes}`, { method: "DELETE", cookie }),
      notes,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ movedArticles: 0 });
    await expect(listCategoryTree(articles)).resolves.toEqual([]);
  });
});

describe("tag endpoint", () => {
  it("adds a display name in a Locale and answers the Tag", async () => {
    const { articles, auth, cookie } = await createFixture();
    const created = await createTag(articles, { locale: "zh", name: "编辑器" });
    if (!created.ok) throw new Error("fixture");

    const response = await updateTagResponse(
      articles,
      auth,
      patch(`/api/admin/tags/${created.tag.id}`, { action: "rename", locale: "en", name: "Editor" }, cookie),
      created.tag.id,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tag: { id: created.tag.id, slug: "编辑器", names: { zh: "编辑器", en: "Editor" } },
    });
  });

  it("maps a bad rename to its status code", async () => {
    const { articles, auth, cookie } = await createFixture();
    const created = await createTag(articles, { locale: "zh", name: "编辑器" });
    if (!created.ok) throw new Error("fixture");

    const cases: [Request, string, number][] = [
      [patch(`/api/admin/tags/${created.tag.id}`, { action: "rename", locale: "en", name: "" }, cookie), "invalid-name", 400],
      [patch(`/api/admin/tags/${created.tag.id}`, { action: "explode" }, cookie), "invalid-action", 400],
    ];

    for (const [request_, error, status] of cases) {
      const response = await updateTagResponse(articles, auth, request_, created.tag.id);
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ error });
    }

    const missing = await updateTagResponse(
      articles,
      auth,
      patch("/api/admin/tags/01ZZZZ", { action: "rename", locale: "en", name: "x" }, cookie),
      "01ZZZZ",
    );
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: "not-found" });
  });

  it("refuses to delete a Tag work is filed under, and deletes an unused one", async () => {
    const { articles, auth, cookie } = await createFixture();
    const used = await createTag(articles, { locale: "zh", name: "编辑器" });
    const unused = await createTag(articles, { locale: "zh", name: "闲置" });
    if (!used.ok || !unused.ok) throw new Error("fixture");
    const draft = await createArticleDraft(articles, { title: "one" });
    await updateArticleMeta(articles, { articleId: draft.id, tagIds: [used.tag.id] });

    const refused = await deleteTagResponse(
      articles,
      auth,
      request(`/api/admin/tags/${used.tag.id}`, { method: "DELETE", cookie }),
      used.tag.id,
    );
    expect(refused.status).toBe(409);
    await expect(refused.json()).resolves.toEqual({
      error: "in-use",
      articleCount: 1,
      postCount: 0,
    });

    const deleted = await deleteTagResponse(
      articles,
      auth,
      request(`/api/admin/tags/${unused.tag.id}`, { method: "DELETE", cookie }),
      unused.tag.id,
    );
    expect(deleted.status).toBe(204);
  });
});
