import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { resolveAuthConfig } from "@/config/auth";
import type { Clock } from "@/domain/clock";
import { insertAuthorSession } from "@/db/auth-repository";
import { encodeFeedCursor, FEED_PAGE_SIZE } from "@/domain/feed-cursor";
import { createAssetContext } from "@/services/assets";
import { createAuthorAuthContext, type AuthorAuthContext } from "@/services/auth";
import {
  addPostTranslation,
  createPostContext,
  createPostDraft,
  publishPost,
  setPostTags,
  type PostContext,
} from "@/services/posts";
import { createTag } from "@/services/tags";
import { createTestHarness, type TestHarness } from "@/test/harness";

import {
  createPostResponse,
  deletePostResponse,
  feedResponse,
  getPostResponse,
  listPostsResponse,
  publicationResponse,
  removePostTranslationResponse,
  savePostTranslationResponse,
  setPostImagesResponse,
  updatePostResponse,
} from "./posts";

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
  posts: PostContext;
  auth: AuthorAuthContext;
  cookie: string;
}

const fixtures: Fixture[] = [];

async function createFixture(startIso = "2025-06-15T08:30:00.000Z"): Promise<Fixture> {
  const harness = await createTestHarness({ now: new Date(startIso) });
  const clock = manualClock(startIso);
  const auth = createAuthorAuthContext(harness.database, clock, resolveAuthConfig(), null);
  const sessionId = randomUUID();
  const now = clock.now();
  insertAuthorSession(harness.database.db, {
    id: sessionId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  });
  const fixture: Fixture = {
    harness,
    clock,
    posts: createPostContext(
      harness.database,
      clock,
      createAssetContext(harness.database, clock, harness.resources.rootDir),
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

function adminRequest(
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Request {
  const { cookie, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (cookie !== undefined) {
    headers.set("cookie", cookie);
  }
  return new Request(`http://localhost${path}`, { ...rest, headers });
}

function jsonRequest(path: string, method: string, body: unknown, cookie?: string): Request {
  return adminRequest(path, {
    method,
    cookie,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seedPublished(
  fixture: Fixture,
  input: { publishTime: string; locale?: "zh" | "en"; tagIds?: string[] },
): Promise<string> {
  const draft = await createPostDraft(fixture.posts, {
    locale: input.locale ?? "zh",
    bodyJson: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hello"}]}]}',
  });
  if (input.tagIds !== undefined) {
    await setPostTags(fixture.posts, { postId: draft.id, tagIds: input.tagIds });
  }
  const published = await publishPost(fixture.posts, {
    postId: draft.id,
    publishTime: input.publishTime,
  });
  if (!published.ok) {
    throw new Error(`could not publish: ${published.reason}`);
  }
  return draft.id;
}

describe("post write endpoints", () => {
  it("rejects every unauthenticated call with 401 JSON before touching a service", async () => {
    const fixture = await createFixture();
    const id = "01JX3Z8Q4A0W7Y6TCVN1KH2M9R";

    const responses = await Promise.all([
      listPostsResponse(fixture.posts, fixture.auth, adminRequest("/api/admin/posts")),
      createPostResponse(
        fixture.posts,
        fixture.auth,
        jsonRequest("/api/admin/posts", "POST", { locale: "zh" }),
      ),
      getPostResponse(fixture.posts, fixture.auth, adminRequest(`/api/admin/posts/${id}`), id),
      updatePostResponse(
        fixture.posts,
        fixture.auth,
        jsonRequest(`/api/admin/posts/${id}`, "PATCH", { tagIds: [] }),
        id,
      ),
      savePostTranslationResponse(
        fixture.posts,
        fixture.auth,
        jsonRequest(`/api/admin/posts/${id}/translations/zh`, "PUT", { baseVersion: 1 }),
        id,
        "zh",
      ),
      setPostImagesResponse(
        fixture.posts,
        fixture.auth,
        jsonRequest(`/api/admin/posts/${id}/images`, "PUT", { assetIds: [] }),
        id,
      ),
      publicationResponse(
        fixture.posts,
        fixture.auth,
        jsonRequest(`/api/admin/posts/${id}/publication`, "POST", { action: "publish" }),
        id,
      ),
      deletePostResponse(
        fixture.posts,
        fixture.auth,
        adminRequest(`/api/admin/posts/${id}`, { method: "DELETE" }),
        id,
      ),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    }
  });

  it("creates a draft, saves its body against the version it read and answers 409 on a stale save", async () => {
    const fixture = await createFixture();

    const created = await createPostResponse(
      fixture.posts,
      fixture.auth,
      jsonRequest("/api/admin/posts", "POST", { locale: "zh" }, fixture.cookie),
    );
    expect(created.status).toBe(201);
    const { post } = (await created.json()) as { post: { id: string; translations: { version: number }[] } };
    expect(post.translations[0]?.version).toBe(1);

    const saved = await savePostTranslationResponse(
      fixture.posts,
      fixture.auth,
      jsonRequest(
        `/api/admin/posts/${post.id}/translations/zh`,
        "PUT",
        {
          baseVersion: 1,
          bodyJson: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"edited"}]}]}',
        },
        fixture.cookie,
      ),
      post.id,
      "zh",
    );
    expect(saved.status).toBe(200);
    await expect(saved.json()).resolves.toMatchObject({
      post: {
        translations: [
          {
            version: 2,
            bodyMarkdown: "edited",
          },
        ],
      },
    });

    const stale = await savePostTranslationResponse(
      fixture.posts,
      fixture.auth,
      jsonRequest(
        `/api/admin/posts/${post.id}/translations/zh`,
        "PUT",
        { baseVersion: 1, bodyJson: '{"type":"doc"}' },
        fixture.cookie,
      ),
      post.id,
      "zh",
    );
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({
      error: "stale-content",
      current: { version: 2 },
    });
  });

  it("derives the Markdown column itself instead of trusting what the client sent", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh" });

    const response = await savePostTranslationResponse(
      fixture.posts,
      fixture.auth,
      jsonRequest(
        `/api/admin/posts/${draft.id}/translations/zh`,
        "PUT",
        {
          baseVersion: 1,
          bodyJson: '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"标题"}]}]}',
          bodyMarkdown: "client supplied lies",
        },
        fixture.cookie,
      ),
      draft.id,
      "zh",
    );

    await expect(response.json()).resolves.toMatchObject({
      post: { translations: [expect.objectContaining({ bodyMarkdown: "## 标题" })] },
    });
  });

  it("deletes permanently with 204 and 404s an unknown Post", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh" });

    const deleted = await deletePostResponse(
      fixture.posts,
      fixture.auth,
      adminRequest(`/api/admin/posts/${draft.id}`, {
        method: "DELETE",
        cookie: fixture.cookie,
      }),
      draft.id,
    );
    expect(deleted.status).toBe(204);

    const again = await deletePostResponse(
      fixture.posts,
      fixture.auth,
      adminRequest(`/api/admin/posts/${draft.id}`, { method: "DELETE", cookie: fixture.cookie }),
      draft.id,
    );
    expect(again.status).toBe(404);
  });
});

describe("the feed endpoint", () => {
  it("serves a page and the cursor for the next one, never caching the answer", async () => {
    const fixture = await createFixture();
    const first = await seedPublished(fixture, { publishTime: "2025-06-13T08:30:00.000Z" });
    const second = await seedPublished(fixture, { publishTime: "2025-06-14T08:30:00.000Z" });

    const response = await feedResponse(
      fixture.posts,
      new Request(`http://localhost/api/public/feed?locale=zh&limit=1`),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const page = (await response.json()) as {
      posts: { id: string; relativeTime: string; absoluteTime: string; bodyHtml: string }[];
      nextCursor: string | null;
    };
    expect(page.posts.map((post) => post.id)).toEqual([second]);
    expect(page.posts[0]).toMatchObject({
      relativeTime: "昨天",
      absoluteTime: "2025-06-14 16:30",
    });
    expect(page.posts[0]?.bodyHtml).toContain("<p>hello</p>");
    expect(page.nextCursor).not.toBeNull();

    const older = await feedResponse(
      fixture.posts,
      new Request(
        `http://localhost/api/public/feed?locale=zh&limit=1&cursor=${encodeURIComponent(page.nextCursor ?? "")}`,
      ),
    );
    const olderPage = (await older.json()) as { posts: { id: string }[]; nextCursor: string | null };
    expect(olderPage.posts.map((post) => post.id)).toEqual([first]);
    expect(olderPage.nextCursor).toBeNull();
  });

  it("defaults to the configured page size when the Reader asks for nothing", async () => {
    const fixture = await createFixture();
    for (let index = 0; index < FEED_PAGE_SIZE + 1; index += 1) {
      await seedPublished(fixture, {
        publishTime: new Date(Date.UTC(2025, 5, index + 1)).toISOString(),
      });
    }

    const page = (await (
      await feedResponse(fixture.posts, new Request("http://localhost/api/public/feed?locale=zh"))
    ).json()) as { posts: unknown[]; nextCursor: string | null };

    expect(page.posts).toHaveLength(FEED_PAGE_SIZE);
    expect(page.nextCursor).not.toBeNull();
  });

  it("filters by the tapped Tag", async () => {
    const fixture = await createFixture();
    const outcome = await createTag({ database: fixture.harness.database, clock: fixture.clock }, {
      locale: "zh",
      name: "旅行",
      slug: "travel",
    });
    if (!outcome.ok) {
      throw new Error("could not create the tag");
    }
    const tagged = await seedPublished(fixture, {
      publishTime: "2025-06-01T00:00:00.000Z",
      tagIds: [outcome.tag.id],
    });
    await seedPublished(fixture, { publishTime: "2025-06-02T00:00:00.000Z" });

    const page = (await (
      await feedResponse(
        fixture.posts,
        new Request("http://localhost/api/public/feed?locale=zh&tag=travel"),
      )
    ).json()) as { posts: { id: string }[] };

    expect(page.posts.map((post) => post.id)).toEqual([tagged]);
  });

  it("refuses a cursor it did not issue and a Locale it does not serve", async () => {
    const fixture = await createFixture();

    const badCursor = await feedResponse(
      fixture.posts,
      new Request("http://localhost/api/public/feed?locale=zh&cursor=not-a-cursor!"),
    );
    expect(badCursor.status).toBe(400);
    await expect(badCursor.json()).resolves.toEqual({ error: "invalid-cursor" });

    const badLocale = await feedResponse(
      fixture.posts,
      new Request("http://localhost/api/public/feed?locale=fr"),
    );
    expect(badLocale.status).toBe(400);
    await expect(badLocale.json()).resolves.toEqual({ error: "invalid-locale" });

    const noLocale = await feedResponse(
      fixture.posts,
      new Request("http://localhost/api/public/feed"),
    );
    expect(noLocale.status).toBe(400);
  });

  it("accepts a cursor produced for a Post that has since been deleted", async () => {
    const fixture = await createFixture();
    await seedPublished(fixture, { publishTime: "2025-06-02T00:00:00.000Z" });
    const older = await seedPublished(fixture, { publishTime: "2025-06-01T00:00:00.000Z" });

    const cursor = encodeFeedCursor({
      publishTime: "2025-06-02T00:00:00.000Z",
      id: "01JX3Z8Q4A0W7Y6TCVN1KH2M9R",
    });
    const page = (await (
      await feedResponse(
        fixture.posts,
        new Request(`http://localhost/api/public/feed?locale=zh&cursor=${encodeURIComponent(cursor)}`),
      )
    ).json()) as { posts: { id: string }[] };

    expect(page.posts.map((post) => post.id)).toEqual([older]);
  });
});

describe("post translation endpoints", () => {
  it("adds a Locale version and lists what the composer needs", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh" });

    const listed = await listPostsResponse(
      fixture.posts,
      fixture.auth,
      adminRequest("/api/admin/posts", { cookie: fixture.cookie }),
    );
    const listedBody = (await listed.json()) as {
      posts: { id: string; translations: { locale: string }[] }[];
    };
    expect(
      listedBody.posts.map((post) => ({
        id: post.id,
        locales: post.translations.map((translation) => translation.locale),
      })),
    ).toEqual([{ id: draft.id, locales: ["zh"] }]);

    const added = await addPostTranslation(fixture.posts, { postId: draft.id, locale: "en" });
    expect(added.ok).toBe(true);
    const fetched = await getPostResponse(
      fixture.posts,
      fixture.auth,
      adminRequest(`/api/admin/posts/${draft.id}`, { cookie: fixture.cookie }),
      draft.id,
    );
    const fetchedBody = (await fetched.json()) as {
      post: { translations: { locale: string }[] };
    };
    expect(fetchedBody.post.translations.map((translation) => translation.locale)).toEqual([
      "zh",
      "en",
    ]);
  });

  it("removes one Locale version and answers with the Post it left", async () => {
    const fixture = await createFixture();
    const created = await createPostResponse(
      fixture.posts,
      fixture.auth,
      jsonRequest("/api/admin/posts", "POST", { locale: "zh" }, fixture.cookie),
    );
    const { post } = (await created.json()) as { post: { id: string } };
    await addPostTranslation(fixture.posts, { postId: post.id, locale: "en" });

    const removed = await removePostTranslationResponse(
      fixture.posts,
      fixture.auth,
      adminRequest(`/api/admin/posts/${post.id}/translations/en`, {
        method: "DELETE",
        cookie: fixture.cookie,
      }),
      post.id,
      "en",
    );

    expect(removed.status).toBe(200);
    const payload = (await removed.json()) as { post: { translations: { locale: string }[] } };
    expect(payload.post.translations.map((translation) => translation.locale)).toEqual(["zh"]);
  });

  it("refuses the default Locale version with 409 and an unknown Locale with 404", async () => {
    const fixture = await createFixture();
    const created = await createPostResponse(
      fixture.posts,
      fixture.auth,
      jsonRequest("/api/admin/posts", "POST", { locale: "zh" }, fixture.cookie),
    );
    const { post } = (await created.json()) as { post: { id: string } };
    await addPostTranslation(fixture.posts, { postId: post.id, locale: "en" });

    const refused = await removePostTranslationResponse(
      fixture.posts,
      fixture.auth,
      adminRequest(`/api/admin/posts/${post.id}/translations/zh`, {
        method: "DELETE",
        cookie: fixture.cookie,
      }),
      post.id,
      "zh",
    );
    expect(refused.status).toBe(409);
    await expect(refused.json()).resolves.toEqual({ error: "default-locale" });

    const invalid = await removePostTranslationResponse(
      fixture.posts,
      fixture.auth,
      adminRequest(`/api/admin/posts/${post.id}/translations/zz`, {
        method: "DELETE",
        cookie: fixture.cookie,
      }),
      post.id,
      "zz",
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: "invalid-locale" });

    const missing = await removePostTranslationResponse(
      fixture.posts,
      fixture.auth,
      adminRequest("/api/admin/posts/01JX3Z8Q4A0W7Y6TCVN1KH2M9R/translations/en", {
        method: "DELETE",
        cookie: fixture.cookie,
      }),
      "01JX3Z8Q4A0W7Y6TCVN1KH2M9R",
      "en",
    );
    expect(missing.status).toBe(404);
  });

  it("changes which version the Post's defaultLocale names through PATCH", async () => {
    const fixture = await createFixture();
    const created = await createPostResponse(
      fixture.posts,
      fixture.auth,
      jsonRequest("/api/admin/posts", "POST", { locale: "zh" }, fixture.cookie),
    );
    const { post } = (await created.json()) as { post: { id: string } };
    await addPostTranslation(fixture.posts, { postId: post.id, locale: "en" });

    const changed = await updatePostResponse(
      fixture.posts,
      fixture.auth,
      jsonRequest(
        `/api/admin/posts/${post.id}`,
        "PATCH",
        { defaultLocale: "en" },
        fixture.cookie,
      ),
      post.id,
    );
    expect(changed.status).toBe(200);
    await expect(changed.json()).resolves.toMatchObject({
      post: { defaultLocale: "en" },
    });

    const refused = await updatePostResponse(
      fixture.posts,
      fixture.auth,
      jsonRequest(
        `/api/admin/posts/${post.id}`,
        "PATCH",
        { defaultLocale: "zz" },
        fixture.cookie,
      ),
      post.id,
    );
    expect(refused.status).toBe(400);
    await expect(refused.json()).resolves.toEqual({ error: "invalid-locale" });

    const nothing = await updatePostResponse(
      fixture.posts,
      fixture.auth,
      jsonRequest(`/api/admin/posts/${post.id}`, "PATCH", {}, fixture.cookie),
      post.id,
    );
    expect(nothing.status).toBe(400);
  });

  it("answers the publication actions and maps an unknown Post to 404", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh" });

    const published = await publicationResponse(
      fixture.posts,
      fixture.auth,
      jsonRequest(
        `/api/admin/posts/${draft.id}/publication`,
        "POST",
        { action: "publish", publishTime: "2025-07-01T09:30" },
        fixture.cookie,
      ),
      draft.id,
    );
    expect(published.status).toBe(200);
    // A datetime-local value is a wall clock: read in the site time zone.
    await expect(published.json()).resolves.toMatchObject({
      post: { publicationState: "published", publishTime: "2025-07-01T01:30:00.000Z" },
    });

    const missing = await publicationResponse(
      fixture.posts,
      fixture.auth,
      jsonRequest(
        "/api/admin/posts/01JX3Z8Q4A0W7Y6TCVN1KH2M9R/publication",
        "POST",
        { action: "archive" },
        fixture.cookie,
      ),
      "01JX3Z8Q4A0W7Y6TCVN1KH2M9R",
    );
    expect(missing.status).toBe(404);
  });
});
