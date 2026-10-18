import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";

import type { Locale } from "@/config/site";
import type { Clock } from "@/domain/clock";
import { isUlid } from "@/domain/ulid";
import { createAssetContext, listOrphanAssets, uploadAsset, type AssetContext } from "@/services/assets";
import { createTag, type TagContext, type TagView } from "@/services/tags";
import { createTestHarness, type TestHarness } from "@/test/harness";

import {
  addPostTranslation,
  createPostContext,
  createPostDraft,
  deletePostPermanently,
  getPost,
  InvalidPostBodyError,
  listPosts,
  publishPost,
  readFeedPage,
  removePostTranslation,
  resolveFeedTag,
  setPostDefaultLocale,
  savePostTranslation,
  setPostImages,
  setPostTags,
  unarchivePost,
  archivePost,
  type PostContext,
} from "./posts";

const DOC = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hello"}]}]}';
const EDITED = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"edited"}]}]}';

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
  assets: AssetContext;
  tags: TagContext;
}

const fixtures: Fixture[] = [];

async function createFixture(startIso = "2025-06-15T08:30:00.000Z"): Promise<Fixture> {
  const harness = await createTestHarness({ now: new Date(startIso) });
  const clock = manualClock(startIso);
  const assets = createAssetContext(harness.database, clock, harness.resources.rootDir);
  const fixture: Fixture = {
    harness,
    clock,
    assets,
    posts: createPostContext(harness.database, clock, assets),
    tags: { database: harness.database, clock },
  };
  fixtures.push(fixture);
  return fixture;
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await fixture.harness.close();
  }
});

async function uploadPicture(fixture: Fixture, fileName: string): Promise<string> {
  const bytes = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
  const summary = await uploadAsset(fixture.assets, { fileName, bytes });
  return summary.id;
}

async function createNamedTag(
  fixture: Fixture,
  name: string,
  slug: string = name,
): Promise<TagView> {
  const outcome = await createTag(fixture.tags, { locale: "zh" as Locale, name, slug });
  if (!outcome.ok) {
    throw new Error(`could not create tag: ${outcome.reason}`);
  }
  return outcome.tag;
}

describe("post drafts", () => {
  it("is an untitled, category-less, slug-less Post with one Locale version", async () => {
    const { posts, clock } = await createFixture();

    const draft = await createPostDraft(posts, {
      locale: "zh",
      bodyJson: DOC,
    });

    expect(isUlid(draft.id)).toBe(true);
    expect(draft.publicationState).toBe("draft");
    expect(draft.visibility).toBe("draft");
    expect(draft.publishTime).toBeNull();
    expect(draft.defaultLocale).toBe("zh");
    expect(draft.translations).toEqual([
      {
        locale: "zh",
        bodyJson: DOC,
        bodyMarkdown: "hello",
        version: 1,
        createdAt: clock.now().toISOString(),
        updatedAt: clock.now().toISOString(),
      },
    ]);
    expect(Object.keys(draft).sort()).toEqual([
      "createdAt",
      "defaultLocale",
      "id",
      "images",
      "publicationState",
      "publishTime",
      "tags",
      "translations",
      "updatedAt",
      "visibility",
    ]);
  });

  it("starts from an empty ProseMirror document when no body is given", async () => {
    const { posts } = await createFixture();

    const draft = await createPostDraft(posts, { locale: "en" });

    expect(draft.translations[0]?.bodyJson).toBe(
      '{"type":"doc","content":[{"type":"paragraph"}]}',
    );
  });

  it("reads a Post back by id, and nothing for an unknown one", async () => {
    const { posts } = await createFixture();
    const draft = await createPostDraft(posts, { locale: "zh", bodyJson: DOC });

    await expect(getPost(posts, draft.id)).resolves.toMatchObject({ id: draft.id });
    await expect(getPost(posts, "01JX3Z8Q4A0W7Y6TCVN1KH2M9R")).resolves.toBeNull();
  });

  it("lists drafts newest first for the Author console", async () => {
    const { posts, clock } = await createFixture();
    const older = await createPostDraft(posts, { locale: "zh", bodyJson: DOC });
    clock.advance(60_000);
    const newer = await createPostDraft(posts, { locale: "en", bodyJson: DOC });

    expect((await listPosts(posts)).map((post) => post.id)).toEqual([newer.id, older.id]);
  });
});

describe("post translations", () => {
  it("saves the body the composer read and bumps the version it must save against", async () => {
    const { posts, clock } = await createFixture();
    const draft = await createPostDraft(posts, { locale: "zh", bodyJson: DOC });
    clock.advance(30_000);

    const saved = await savePostTranslation(posts, {
      postId: draft.id,
      locale: "zh",
      baseVersion: 1,
      bodyJson: EDITED,
    });

    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.post.translations[0]).toMatchObject({
      locale: "zh",
      bodyJson: EDITED,
      bodyMarkdown: "edited",
      version: 2,
      updatedAt: clock.now().toISOString(),
    });
    expect(saved.post.updatedAt).toBe(clock.now().toISOString());
  });

  it("refuses a save derived from a version the server has moved past", async () => {
    const { posts } = await createFixture();
    const draft = await createPostDraft(posts, { locale: "zh", bodyJson: DOC });
    await savePostTranslation(posts, {
      postId: draft.id,
      locale: "zh",
      baseVersion: 1,
      bodyJson: EDITED,
    });

    const stale = await savePostTranslation(posts, {
      postId: draft.id,
      locale: "zh",
      baseVersion: 1,
      bodyJson: DOC,
    });

    expect(stale).toMatchObject({ ok: false, reason: "stale-content" });
    if (stale.ok || stale.reason !== "stale-content") return;
    expect(stale.current).toMatchObject({ bodyJson: EDITED, version: 2 });
    await expect(getPost(posts, draft.id)).resolves.toMatchObject({
      translations: [expect.objectContaining({ bodyJson: EDITED })],
    });
  });

  it("writes a second Locale version, and refuses the same Locale twice", async () => {
    const { posts } = await createFixture();
    const draft = await createPostDraft(posts, { locale: "zh", bodyJson: DOC });

    const added = await addPostTranslation(posts, {
      postId: draft.id,
      locale: "en",
      bodyJson: DOC,
    });

    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.post.translations.map((translation) => translation.locale)).toEqual(["zh", "en"]);
    expect(added.post.defaultLocale).toBe("zh");
    await expect(
      addPostTranslation(posts, { postId: draft.id, locale: "en", bodyJson: DOC }),
    ).resolves.toEqual({ ok: false, reason: "duplicate-locale" });
  });

  it("refuses a body that is not a ProseMirror document", async () => {
    const { posts } = await createFixture();
    const draft = await createPostDraft(posts, { locale: "zh", bodyJson: DOC });

    await expect(
      savePostTranslation(posts, {
        postId: draft.id,
        locale: "zh",
        baseVersion: 1,
        bodyJson: '{"type":"paragraph"}',
      }),
    ).rejects.toThrow(InvalidPostBodyError);
  });

  it("has nothing to save for an unknown Post or an unknown Locale version", async () => {
    const { posts } = await createFixture();
    const draft = await createPostDraft(posts, { locale: "zh", bodyJson: DOC });

    await expect(
      savePostTranslation(posts, {
        postId: "01JX3Z8Q4A0W7Y6TCVN1KH2M9R",
        locale: "zh",
        baseVersion: 1,
        bodyJson: DOC,
      }),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
    await expect(
      savePostTranslation(posts, { postId: draft.id, locale: "en", baseVersion: 1, bodyJson: DOC }),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
  });
});

describe("post images", () => {
  it("keeps the image set in the order the composer arranged it", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });
    const first = await uploadPicture(fixture, "first.png");
    const second = await uploadPicture(fixture, "second.png");
    const third = await uploadPicture(fixture, "third.png");

    const attached = await setPostImages(fixture.posts, {
      postId: draft.id,
      assetIds: [first, second, third],
    });
    expect(attached.ok && attached.post.images.map((image) => image.assetId)).toEqual([
      first,
      second,
      third,
    ]);

    const reordered = await setPostImages(fixture.posts, {
      postId: draft.id,
      assetIds: [third, first],
    });
    expect(reordered.ok && reordered.post.images.map((image) => image.assetId)).toEqual([
      third,
      first,
    ]);
    expect(reordered.ok && reordered.post.images[0]).toMatchObject({ width: 1200, height: 800 });

    const emptied = await setPostImages(fixture.posts, { postId: draft.id, assetIds: [] });
    expect(emptied.ok && emptied.post.images).toEqual([]);
  });

  it("ignores a repeated Asset instead of storing the same picture twice", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });
    const picture = await uploadPicture(fixture, "only.png");

    const attached = await setPostImages(fixture.posts, {
      postId: draft.id,
      assetIds: [picture, picture],
    });

    expect(attached.ok && attached.post.images.map((image) => image.assetId)).toEqual([picture]);
  });

  it("refuses an Asset that is not in the library and leaves the set untouched", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });
    const picture = await uploadPicture(fixture, "kept.png");
    await setPostImages(fixture.posts, { postId: draft.id, assetIds: [picture] });

    const refused = await setPostImages(fixture.posts, {
      postId: draft.id,
      assetIds: [picture, "0b8f0b7e-0000-4000-8000-000000000000"],
    });

    expect(refused).toEqual({ ok: false, reason: "unknown-asset" });
    await expect(getPost(fixture.posts, draft.id)).resolves.toMatchObject({
      images: [expect.objectContaining({ assetId: picture })],
    });
  });

  it("counts attached images as references, so the Asset library does not offer them as orphans", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });
    const picture = await uploadPicture(fixture, "referenced.png");

    await setPostImages(fixture.posts, { postId: draft.id, assetIds: [picture] });

    const orphans = await listOrphanAssets(fixture.assets);
    expect(orphans.map((orphan) => orphan.id)).not.toContain(picture);
  });

  it("releases the reference again when the picture is removed, and when the Post is deleted", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });
    const picture = await uploadPicture(fixture, "released.png");
    await setPostImages(fixture.posts, { postId: draft.id, assetIds: [picture] });

    await setPostImages(fixture.posts, { postId: draft.id, assetIds: [] });
    expect((await listOrphanAssets(fixture.assets)).map((orphan) => orphan.id)).toContain(picture);

    await setPostImages(fixture.posts, { postId: draft.id, assetIds: [picture] });
    await deletePostPermanently(fixture.posts, draft.id);
    expect((await listOrphanAssets(fixture.assets)).map((orphan) => orphan.id)).toContain(picture);
  });
});

describe("post tags", () => {
  it("assigns the whole set at once, replacing what was there", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });
    const taiwan = await createNamedTag(fixture, "台湾", "taiwan");
    const reading = await createNamedTag(fixture, "读书", "reading");

    const first = await setPostTags(fixture.posts, {
      postId: draft.id,
      tagIds: [taiwan.id, reading.id],
    });
    expect(first.ok && first.post.tags.map((tag) => tag.slug)).toEqual(["reading", "taiwan"]);

    const replaced = await setPostTags(fixture.posts, {
      postId: draft.id,
      tagIds: [reading.id],
    });
    expect(replaced.ok && replaced.post.tags.map((tag) => tag.slug)).toEqual(["reading"]);

    const cleared = await setPostTags(fixture.posts, { postId: draft.id, tagIds: [] });
    expect(cleared.ok && cleared.post.tags).toEqual([]);
  });

  it("refuses a Tag the site does not have", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });

    await expect(
      setPostTags(fixture.posts, { postId: draft.id, tagIds: ["01JX3Z8Q4A0W7Y6TCVN1KH2M9R"] }),
    ).resolves.toEqual({ ok: false, reason: "unknown-tag" });
  });
});

describe("post lifecycle", () => {
  it("publishes immediately, judged by the injected clock", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });

    const published = await publishPost(fixture.posts, { postId: draft.id });

    expect(published.ok && published.post).toMatchObject({
      publicationState: "published",
      visibility: "visible",
      publishTime: fixture.clock.now().toISOString(),
    });
  });

  it("holds a Post scheduled for later out of the Reader's sight until its time arrives", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });
    const later = new Date(fixture.clock.now().getTime() + 3_600_000).toISOString();

    const scheduled = await publishPost(fixture.posts, {
      postId: draft.id,
      publishTime: later,
    });
    expect(scheduled.ok && scheduled.post).toMatchObject({
      publicationState: "published",
      visibility: "scheduled",
      publishTime: later,
    });
    await expect(
      readFeedPage(fixture.posts, { locale: "zh" }),
    ).resolves.toMatchObject({ posts: [] });

    fixture.clock.advance(3_600_000);
    const due = await getPost(fixture.posts, draft.id);
    expect(due?.visibility).toBe("visible");
    await expect(readFeedPage(fixture.posts, { locale: "zh" })).resolves.toMatchObject({
      posts: [expect.objectContaining({ id: draft.id })],
    });
  });

  it("archives a published Post and brings it back, refusing the wrong direction", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });

    await expect(archivePost(fixture.posts, { postId: draft.id })).resolves.toEqual({
      ok: false,
      reason: "not-published",
    });

    await publishPost(fixture.posts, { postId: draft.id });
    const archived = await archivePost(fixture.posts, { postId: draft.id });
    expect(archived.ok && archived.post.visibility).toBe("archived");
    await expect(readFeedPage(fixture.posts, { locale: "zh" })).resolves.toMatchObject({
      posts: [],
    });

    await expect(
      publishPost(fixture.posts, { postId: draft.id, publishTime: "not-an-instant" }),
    ).resolves.toEqual({ ok: false, reason: "invalid-publish-time" });

    const unarchived = await unarchivePost(fixture.posts, { postId: draft.id });
    expect(unarchived.ok && unarchived.post.visibility).toBe("visible");
    await expect(unarchivePost(fixture.posts, { postId: draft.id })).resolves.toEqual({
      ok: false,
      reason: "not-archived",
    });
  });

  it("permanently deletes a Post with its images and tags, and reports an unknown one", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });
    const picture = await uploadPicture(fixture, "gone.png");
    const tag = await createNamedTag(fixture, "随手记", "notes");
    await setPostImages(fixture.posts, { postId: draft.id, assetIds: [picture] });
    await setPostTags(fixture.posts, { postId: draft.id, tagIds: [tag.id] });

    await expect(deletePostPermanently(fixture.posts, draft.id)).resolves.toEqual({
      deleted: true,
    });
    await expect(getPost(fixture.posts, draft.id)).resolves.toBeNull();
    expect(
      fixture.harness.database.sqlite.prepare("SELECT COUNT(*) AS n FROM post_image").get(),
    ).toEqual({ n: 0 });
    expect(
      fixture.harness.database.sqlite.prepare("SELECT COUNT(*) AS n FROM post_tag").get(),
    ).toEqual({ n: 0 });
    await expect(deletePostPermanently(fixture.posts, draft.id)).resolves.toEqual({
      deleted: false,
      reason: "not-found",
    });
  });
});

interface SeedPostInput {
  locale?: Locale;
  publishTime: string;
  /** Extra Locale versions beside the first one. */
  alsoIn?: Locale[];
  tagIds?: string[];
  imageIds?: string[];
  body?: string;
}

async function seedFeedPost(fixture: Fixture, input: SeedPostInput): Promise<string> {
  const locale = input.locale ?? "zh";
  const draft = await createPostDraft(fixture.posts, {
    locale,
    bodyJson: input.body ?? DOC,
  });

  for (const extra of input.alsoIn ?? []) {
    const added = await addPostTranslation(fixture.posts, {
      postId: draft.id,
      locale: extra,
      bodyJson: DOC,
    });
    if (!added.ok) {
      throw new Error(`could not add translation: ${added.reason}`);
    }
  }
  if (input.tagIds !== undefined) {
    const tagged = await setPostTags(fixture.posts, { postId: draft.id, tagIds: input.tagIds });
    if (!tagged.ok) {
      throw new Error(`could not tag: ${tagged.reason}`);
    }
  }
  if (input.imageIds !== undefined) {
    const imaged = await setPostImages(fixture.posts, {
      postId: draft.id,
      assetIds: input.imageIds,
    });
    if (!imaged.ok) {
      throw new Error(`could not attach images: ${imaged.reason}`);
    }
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

describe("Locale versions", () => {
  it("removes one Locale version and leaves the work, its images and its Tags intact", async () => {
    const fixture = await createFixture();
    const picture = await uploadPicture(fixture, "kept.png");
    const tag = await createNamedTag(fixture, "保留", "kept");
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });
    await addPostTranslation(fixture.posts, { postId: draft.id, locale: "en", bodyJson: EDITED });
    await setPostImages(fixture.posts, { postId: draft.id, assetIds: [picture] });
    await setPostTags(fixture.posts, { postId: draft.id, tagIds: [tag.id] });

    const removed = await removePostTranslation(fixture.posts, {
      postId: draft.id,
      locale: "en",
    });
    if (!removed.ok) {
      throw new Error(`could not remove: ${removed.reason}`);
    }

    expect(removed.post.id).toBe(draft.id);
    expect(removed.post.translations.map((translation) => translation.locale)).toEqual(["zh"]);
    expect(removed.post.translations[0]?.bodyJson).toBe(DOC);
    expect(removed.post.images.map((image) => image.assetId)).toEqual([picture]);
    expect(removed.post.tags.map((tagged) => tagged.id)).toEqual([tag.id]);
    expect(removed.post.defaultLocale).toBe("zh");
  });

  it("refuses to remove the default Locale version, which Content Fallback needs", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });
    await addPostTranslation(fixture.posts, { postId: draft.id, locale: "en", bodyJson: EDITED });

    await expect(
      removePostTranslation(fixture.posts, { postId: draft.id, locale: "zh" }),
    ).resolves.toEqual({ ok: false, reason: "default-locale" });
    expect((await getPost(fixture.posts, draft.id))?.translations).toHaveLength(2);
  });

  it("refuses the last remaining version, the backstop behind the default rule", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });
    // The default-Locale rule is checked first, so the last-version refusal only
    // answers for a Post whose default Locale no longer has a row.
    fixture.harness.database.sqlite
      .prepare("UPDATE post SET default_locale = ? WHERE id = ?")
      .run("en", draft.id);

    await expect(
      removePostTranslation(fixture.posts, { postId: draft.id, locale: "zh" }),
    ).resolves.toEqual({ ok: false, reason: "last-translation" });
  });

  it("has nothing to remove for an unknown Post or a Locale it does not have", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });

    await expect(
      removePostTranslation(fixture.posts, { postId: "01JWZZZZZZZZZZZZZZZZZZZZZZ", locale: "en" }),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
    await expect(
      removePostTranslation(fixture.posts, { postId: draft.id, locale: "en" }),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
  });

  it("lets the Author choose which version is the work's default", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });
    await addPostTranslation(fixture.posts, { postId: draft.id, locale: "en", bodyJson: EDITED });

    const changed = await setPostDefaultLocale(fixture.posts, {
      postId: draft.id,
      defaultLocale: "en",
    });

    expect(changed.ok && changed.post.defaultLocale).toBe("en");
    // The new default is the one that cannot be removed any more, and the
    // version it used to be can.
    await expect(
      removePostTranslation(fixture.posts, { postId: draft.id, locale: "en" }),
    ).resolves.toEqual({ ok: false, reason: "default-locale" });
    await expect(
      removePostTranslation(fixture.posts, { postId: draft.id, locale: "zh" }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("refuses a default Locale the Post has no version in, and an unknown Post", async () => {
    const fixture = await createFixture();
    const draft = await createPostDraft(fixture.posts, { locale: "zh", bodyJson: DOC });

    await expect(
      setPostDefaultLocale(fixture.posts, { postId: draft.id, defaultLocale: "en" }),
    ).resolves.toEqual({ ok: false, reason: "invalid-locale" });
    await expect(
      setPostDefaultLocale(fixture.posts, {
        postId: "01JWZZZZZZZZZZZZZZZZZZZZZZ",
        defaultLocale: "zh",
      }),
    ).resolves.toEqual({ ok: false, reason: "not-found" });
  });
});

describe("the feed read", () => {
  it("is locale-strict: a Post without a version in the Locale is not in that Feed", async () => {
    const fixture = await createFixture();
    const zhOnly = await seedFeedPost(fixture, {
      locale: "zh",
      publishTime: "2025-06-01T00:00:00.000Z",
    });
    const enOnly = await seedFeedPost(fixture, {
      locale: "en",
      publishTime: "2025-06-02T00:00:00.000Z",
    });
    const both = await seedFeedPost(fixture, {
      locale: "zh",
      alsoIn: ["en"],
      publishTime: "2025-06-03T00:00:00.000Z",
    });

    expect((await readFeedPage(fixture.posts, { locale: "zh" })).posts.map((post) => post.id)).toEqual([
      both,
      zhOnly,
    ]);
    expect((await readFeedPage(fixture.posts, { locale: "en" })).posts.map((post) => post.id)).toEqual([
      both,
      enOnly,
    ]);
  });

  it("drops a Post from a Feed once that Locale's version is removed", async () => {
    const fixture = await createFixture();
    const both = await seedFeedPost(fixture, {
      locale: "zh",
      alsoIn: ["en"],
      publishTime: "2025-06-01T00:00:00.000Z",
    });

    expect((await readFeedPage(fixture.posts, { locale: "en" })).posts.map((post) => post.id)).toEqual([
      both,
    ]);

    await removePostTranslation(fixture.posts, { postId: both, locale: "en" });

    expect((await readFeedPage(fixture.posts, { locale: "en" })).posts).toEqual([]);
    expect((await readFeedPage(fixture.posts, { locale: "zh" })).posts.map((post) => post.id)).toEqual([
      both,
    ]);
  });

  it("never falls back to the default Locale, unlike an Article page", async () => {
    const fixture = await createFixture();
    await createPostDraft(fixture.posts, { locale: "zh", defaultLocale: "zh", bodyJson: DOC });
    const seeded = await seedFeedPost(fixture, {
      locale: "zh",
      publishTime: "2025-06-01T00:00:00.000Z",
    });

    expect((await readFeedPage(fixture.posts, { locale: "en" })).posts).toEqual([]);
    expect((await readFeedPage(fixture.posts, { locale: "zh" })).posts.map((post) => post.id)).toEqual([
      seeded,
    ]);
  });

  it("is newest first and breaks a shared Publish Time by Post id, descending", async () => {
    const fixture = await createFixture();
    const one = await seedFeedPost(fixture, { publishTime: "2025-06-01T00:00:00.000Z" });
    const two = await seedFeedPost(fixture, { publishTime: "2025-06-01T00:00:00.000Z" });
    const three = await seedFeedPost(fixture, { publishTime: "2025-06-01T00:00:00.000Z" });
    const newest = await seedFeedPost(fixture, { publishTime: "2025-06-02T00:00:00.000Z" });

    const ids = (await readFeedPage(fixture.posts, { locale: "zh" })).posts.map((post) => post.id);

    expect(ids).toEqual([newest, ...[one, two, three].sort().reverse()]);
  });

  it("pages with the cursor without repeating or skipping a Post", async () => {
    const fixture = await createFixture();
    const published: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      published.push(
        await seedFeedPost(fixture, {
          publishTime: new Date(Date.UTC(2025, 5, index + 1)).toISOString(),
        }),
      );
    }
    const expected = [...published].reverse();

    const first = await readFeedPage(fixture.posts, { locale: "zh", pageSize: 2 });
    expect(first.posts.map((post) => post.id)).toEqual(expected.slice(0, 2));
    expect(first.nextCursor).not.toBeNull();

    const second = await readFeedPage(fixture.posts, {
      locale: "zh",
      pageSize: 2,
      cursor: first.nextCursor,
    });
    expect(second.posts.map((post) => post.id)).toEqual(expected.slice(2, 4));

    const third = await readFeedPage(fixture.posts, {
      locale: "zh",
      pageSize: 2,
      cursor: second.nextCursor,
    });
    expect(third.posts.map((post) => post.id)).toEqual(expected.slice(4));
    expect(third.nextCursor).toBeNull();
  });

  it("offers no next page when nothing older exists", async () => {
    const fixture = await createFixture();
    await seedFeedPost(fixture, { publishTime: "2025-06-01T00:00:00.000Z" });

    const page = await readFeedPage(fixture.posts, { locale: "zh" });

    expect(page.posts).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it("keeps an empty Feed empty, with no cursor to follow", async () => {
    const fixture = await createFixture();

    await expect(readFeedPage(fixture.posts, { locale: "zh" })).resolves.toEqual({
      posts: [],
      nextCursor: null,
    });
  });

  it("shows only Posts carrying the tapped Tag, in the requested Locale", async () => {
    const fixture = await createFixture();
    const travel = await createNamedTag(fixture, "旅行", "travel");
    const withTag = await seedFeedPost(fixture, {
      publishTime: "2025-06-01T00:00:00.000Z",
      tagIds: [travel.id],
    });
    await seedFeedPost(fixture, { publishTime: "2025-06-02T00:00:00.000Z" });
    await seedFeedPost(fixture, {
      locale: "en",
      publishTime: "2025-06-03T00:00:00.000Z",
      tagIds: [travel.id],
    });

    expect(
      (await readFeedPage(fixture.posts, { locale: "zh", tagSlug: "travel" })).posts.map(
        (post) => post.id,
      ),
    ).toEqual([withTag]);
  });

  it("reports a Slug no Tag answers to as unknown, and filters nothing by it", async () => {
    const fixture = await createFixture();
    await createNamedTag(fixture, "旅行", "travel");

    expect(resolveFeedTag(fixture.posts, { locale: "zh", tagSlug: "no-such-tag" })).toEqual({
      kind: "unknown",
      slug: "no-such-tag",
    });
  });

  it("names the Tag a filtered Feed is showing, in the Reader's Locale", async () => {
    const fixture = await createFixture();
    await createNamedTag(fixture, "旅行", "travel");

    expect(resolveFeedTag(fixture.posts, { locale: "zh", tagSlug: "travel" })).toEqual({
      kind: "tag",
      tag: { slug: "travel", name: "旅行" },
    });
    expect(resolveFeedTag(fixture.posts, { locale: "zh", tagSlug: null })).toEqual({ kind: "all" });
  });

  it("carries the body, the ordered image set and the Tag names a card needs", async () => {
    const fixture = await createFixture();
    const first = await uploadPicture(fixture, "first.png");
    const second = await uploadPicture(fixture, "second.png");
    const travel = await createNamedTag(fixture, "旅行", "travel");
    await seedFeedPost(fixture, {
      publishTime: "2025-06-01T00:00:00.000Z",
      imageIds: [second, first],
      tagIds: [travel.id],
      body: EDITED,
    });

    const [post] = (await readFeedPage(fixture.posts, { locale: "zh" })).posts;
    if (post === undefined) {
      throw new Error("expected one Post in the Feed");
    }

    expect(post.bodyJson).toBe(EDITED);
    expect(post.images.map((image) => image.src)).toEqual([
      `/media/${second}/display.webp`,
      `/media/${first}/display.webp`,
    ]);
    // The uploaded file name is metadata, not a description of the picture.
    expect(post.images[0]).toMatchObject({
      original: `/media/${second}/original.png`,
      width: 1200,
      height: 800,
      alt: "",
    });
    expect(post.tags).toEqual([{ slug: "travel", name: "旅行" }]);
  });
});
