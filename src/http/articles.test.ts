import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { resolveAuthConfig } from "@/config/auth";
import { insertAuthorSession } from "@/db/auth-repository";
import { createArticleContext, type ArticleContext } from "@/services/articles";
import { createAssetContext } from "@/services/assets";
import { createAuthorAuthContext, type AuthorAuthContext } from "@/services/auth";
import { createTestHarness, type TestHarness } from "@/test/harness";

import {
  addTranslationResponse,
  createArticleResponse,
  deleteArticleResponse,
  getArticleResponse,
  listArticlesResponse,
  publicationResponse,
  saveTranslationResponse,
  updateArticleResponse,
} from "./articles";
import { createCategoryResponse, createTagResponse, listCategoriesResponse } from "./catalogue";

interface HttpFixture {
  harness: TestHarness;
  articles: ArticleContext;
  auth: AuthorAuthContext;
  cookie: string;
}

const DOC = '{"type":"doc","content":[{"type":"paragraph","text":"hello"}]}';

const fixtures: HttpFixture[] = [];

async function createHttpFixture(): Promise<HttpFixture> {
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
  const assets = createAssetContext(harness.database, harness.clock, harness.resources.rootDir);
  const fixture = {
    harness,
    articles: createArticleContext(harness.database, harness.clock, assets),
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

function adminRequest(path: string, init: RequestInit & { cookie?: string } = {}): Request {
  const { cookie, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("content-type", "application/json");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return new Request(`http://localhost${path}`, { ...rest, headers });
}

describe("article write API", () => {
  it("rejects unauthenticated calls with 401 JSON", async () => {
    const { articles, auth } = await createHttpFixture();

    const list = await listArticlesResponse(articles, auth, adminRequest("/api/admin/articles"));
    expect(list.status).toBe(401);
    await expect(list.json()).resolves.toEqual({ error: "unauthorized" });

    const create = await createArticleResponse(
      articles,
      auth,
      adminRequest("/api/admin/articles", { method: "POST", body: '{"title":"x"}' }),
    );
    expect(create.status).toBe(401);
    await expect(create.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("creates a draft and returns it with 201", async () => {
    const { articles, auth, cookie } = await createHttpFixture();

    const response = await createArticleResponse(
      articles,
      auth,
      adminRequest("/api/admin/articles", {
        method: "POST",
        cookie,
        body: JSON.stringify({ title: "Hello", locale: "zh" }),
      }),
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as { article: { slug: string; id: string } };
    expect(payload.article.slug).toBe("hello");
  });

  it("returns 400 for a malformed JSON body", async () => {
    const { articles, auth, cookie } = await createHttpFixture();

    const response = await createArticleResponse(
      articles,
      auth,
      adminRequest("/api/admin/articles", { method: "POST", cookie, body: "{" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid-json" });
  });

  it("publishes, then archives, an article through one publication endpoint", async () => {
    const { articles, auth, cookie } = await createHttpFixture();
    const created = await createArticleResponse(
      articles,
      auth,
      adminRequest("/api/admin/articles", {
        method: "POST",
        cookie,
        body: JSON.stringify({ title: "Live", locale: "zh" }),
      }),
    );
    const { article } = (await created.json()) as { article: { id: string } };

    const published = await publicationResponse(
      articles,
      auth,
      adminRequest(`/api/admin/articles/${article.id}/publication`, {
        method: "POST",
        cookie,
        body: JSON.stringify({ action: "publish" }),
      }),
      article.id,
    );
    expect(published.status).toBe(200);
    const publishedBody = (await published.json()) as {
      article: { publicationState: string; publishTime: string | null };
    };
    expect(publishedBody.article.publicationState).toBe("published");
    expect(publishedBody.article.publishTime).toBe("2025-06-15T08:30:00.000Z");

    const archived = await publicationResponse(
      articles,
      auth,
      adminRequest(`/api/admin/articles/${article.id}/publication`, {
        method: "POST",
        cookie,
        body: JSON.stringify({ action: "archive" }),
      }),
      article.id,
    );
    expect(archived.status).toBe(200);
    await expect(archived.json()).resolves.toMatchObject({
      article: { publicationState: "archived" },
    });
  });

  it("reads a publish time expressed in the site timezone", async () => {
    const { articles, auth, cookie } = await createHttpFixture();
    const created = await createArticleResponse(
      articles,
      auth,
      adminRequest("/api/admin/articles", {
        method: "POST",
        cookie,
        body: JSON.stringify({ title: "Later", locale: "zh" }),
      }),
    );
    const { article } = (await created.json()) as { article: { id: string } };

    const response = await publicationResponse(
      articles,
      auth,
      adminRequest(`/api/admin/articles/${article.id}/publication`, {
        method: "POST",
        cookie,
        body: JSON.stringify({ action: "publish", publishTime: "2025-06-15T20:00" }),
      }),
      article.id,
    );

    await expect(response.json()).resolves.toMatchObject({
      article: { publicationState: "published", publishTime: "2025-06-15T12:00:00.000Z" },
    });
  });

  it("saves a translation and rejects a second row for the same locale with 409", async () => {
    const { articles, auth, cookie } = await createHttpFixture();
    const created = await createArticleResponse(
      articles,
      auth,
      adminRequest("/api/admin/articles", {
        method: "POST",
        cookie,
        body: JSON.stringify({ title: "Saved", locale: "zh" }),
      }),
    );
    const { article } = (await created.json()) as { article: { id: string } };

    const saved = await saveTranslationResponse(
      articles,
      auth,
      adminRequest(`/api/admin/articles/${article.id}/translations/zh`, {
        method: "PUT",
        cookie,
        body: JSON.stringify({ baseVersion: 1, title: "Saved twice", bodyMarkdown: "body" }),
      }),
      article.id,
      "zh",
    );
    expect(saved.status).toBe(200);
    await expect(saved.json()).resolves.toMatchObject({
      article: { translations: [{ title: "Saved twice", version: 2 }] },
    });

    const duplicate = await addTranslationResponse(
      articles,
      auth,
      adminRequest(`/api/admin/articles/${article.id}/translations`, {
        method: "POST",
        cookie,
        body: JSON.stringify({ locale: "zh" }),
      }),
      article.id,
    );
    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toEqual({ error: "duplicate-locale" });
  });

  it("answers 409 with the server copy when the save was derived from an older version", async () => {
    const { articles, auth, cookie } = await createHttpFixture();
    const created = await createArticleResponse(
      articles,
      auth,
      adminRequest("/api/admin/articles", {
        method: "POST",
        cookie,
        body: JSON.stringify({ title: "Base", locale: "zh", bodyJson: DOC }),
      }),
    );
    const { article } = (await created.json()) as { article: { id: string } };

    const serverSave = await saveTranslationResponse(
      articles,
      auth,
      adminRequest(`/api/admin/articles/${article.id}/translations/zh`, {
        method: "PUT",
        cookie,
        body: JSON.stringify({ baseVersion: 1, title: "Server wins", bodyJson: DOC }),
      }),
      article.id,
      "zh",
    );
    expect(serverSave.status).toBe(200);

    const stale = await saveTranslationResponse(
      articles,
      auth,
      adminRequest(`/api/admin/articles/${article.id}/translations/zh`, {
        method: "PUT",
        cookie,
        body: JSON.stringify({ baseVersion: 1, title: "Local loses" }),
      }),
      article.id,
      "zh",
    );

    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({
      error: "stale-content",
      current: { locale: "zh", title: "Server wins", bodyJson: DOC, version: 2 },
    });

    const reloaded = await saveTranslationResponse(
      articles,
      auth,
      adminRequest(`/api/admin/articles/${article.id}/translations/zh`, {
        method: "PUT",
        cookie,
        body: JSON.stringify({ baseVersion: 2, title: "Caught up" }),
      }),
      article.id,
      "zh",
    );
    expect(reloaded.status).toBe(200);
  });

  it("rejects a translation save that carries no base version with 400", async () => {
    const { articles, auth, cookie } = await createHttpFixture();
    const created = await createArticleResponse(
      articles,
      auth,
      adminRequest("/api/admin/articles", {
        method: "POST",
        cookie,
        body: JSON.stringify({ title: "Base", locale: "zh" }),
      }),
    );
    const { article } = (await created.json()) as { article: { id: string } };

    for (const body of [{ title: "No version" }, { baseVersion: "2", title: "Stringy" }]) {
      const response = await saveTranslationResponse(
        articles,
        auth,
        adminRequest(`/api/admin/articles/${article.id}/translations/zh`, {
          method: "PUT",
          cookie,
          body: JSON.stringify(body),
        }),
        article.id,
        "zh",
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "invalid-base-version" });
    }

    const detail = await getArticleResponse(
      articles,
      auth,
      adminRequest(`/api/admin/articles/${article.id}`, { cookie }),
      article.id,
    );
    await expect(detail.json()).resolves.toMatchObject({
      article: { translations: [{ title: "Base", version: 1 }] },
    });
  });

  it("rejects an unsupported locale in the path with 400", async () => {
    const { articles, auth, cookie } = await createHttpFixture();

    const response = await saveTranslationResponse(
      articles,
      auth,
      adminRequest("/api/admin/articles/unknown/translations/fr", {
        method: "PUT",
        cookie,
        body: "{}",
      }),
      "unknown",
      "fr",
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid-locale" });
  });

  it("answers 404 for an unknown article and 204 once it is permanently deleted", async () => {
    const { articles, auth, cookie } = await createHttpFixture();
    const created = await createArticleResponse(
      articles,
      auth,
      adminRequest("/api/admin/articles", {
        method: "POST",
        cookie,
        body: JSON.stringify({ title: "Gone", locale: "zh" }),
      }),
    );
    const { article } = (await created.json()) as { article: { id: string } };

    const removed = await deleteArticleResponse(
      articles,
      auth,
      adminRequest(`/api/admin/articles/${article.id}`, { method: "DELETE", cookie }),
      article.id,
    );
    expect(removed.status).toBe(204);

    const missing = await getArticleResponse(
      articles,
      auth,
      adminRequest(`/api/admin/articles/${article.id}`, { cookie }),
      article.id,
    );
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: "not-found" });
  });

  it("renames the slug through the meta endpoint", async () => {
    const { articles, auth, cookie } = await createHttpFixture();
    const created = await createArticleResponse(
      articles,
      auth,
      adminRequest("/api/admin/articles", {
        method: "POST",
        cookie,
        body: JSON.stringify({ title: "Old Name", locale: "zh" }),
      }),
    );
    const { article } = (await created.json()) as { article: { id: string } };

    const response = await updateArticleResponse(
      articles,
      auth,
      adminRequest(`/api/admin/articles/${article.id}`, {
        method: "PATCH",
        cookie,
        body: JSON.stringify({ slug: "New Name" }),
      }),
      article.id,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ article: { slug: "new-name" } });
  });
});

describe("category and tag write API", () => {
  it("rejects unauthenticated category creation", async () => {
    const { articles, auth } = await createHttpFixture();

    const response = await createCategoryResponse(
      articles,
      auth,
      adminRequest("/api/admin/categories", { method: "POST", body: '{"name":"x"}' }),
    );

    expect(response.status).toBe(401);
  });

  it("creates a category and a tag for the author's locale", async () => {
    const { articles, auth, cookie } = await createHttpFixture();

    const category = await createCategoryResponse(
      articles,
      auth,
      adminRequest("/api/admin/categories", {
        method: "POST",
        cookie,
        body: JSON.stringify({ name: "Engineering", locale: "en" }),
      }),
    );
    expect(category.status).toBe(201);
    await expect(category.json()).resolves.toMatchObject({
      category: { slug: "engineering", path: "engineering" },
    });

    const tag = await createTagResponse(
      articles,
      auth,
      adminRequest("/api/admin/tags", {
        method: "POST",
        cookie,
        body: JSON.stringify({ name: "Notes", locale: "en" }),
      }),
    );
    expect(tag.status).toBe(201);

    const tree = await listCategoriesResponse(
      articles,
      auth,
      adminRequest("/api/admin/categories", { cookie }),
    );
    await expect(tree.json()).resolves.toMatchObject({ categories: [{ slug: "engineering" }] });
  });

  it("answers 409 for a duplicate category path", async () => {
    const { articles, auth, cookie } = await createHttpFixture();
    await createCategoryResponse(
      articles,
      auth,
      adminRequest("/api/admin/categories", {
        method: "POST",
        cookie,
        body: JSON.stringify({ name: "Engineering", locale: "en" }),
      }),
    );

    const duplicate = await createCategoryResponse(
      articles,
      auth,
      adminRequest("/api/admin/categories", {
        method: "POST",
        cookie,
        body: JSON.stringify({ name: "Engineering", locale: "zh" }),
      }),
    );

    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toEqual({ error: "duplicate-slug" });
  });
});
