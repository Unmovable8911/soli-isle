import { isLocale, siteConfig } from "@/config/site";
import {
  decodeFeedCursor,
  encodeFeedCursor,
  normaliseFeedPageSize,
  FEED_PAGE_SIZE,
  type FeedCursor,
} from "@/domain/feed-cursor";
import type { FeedView } from "@/domain/feed-view";
import { pickLocalised } from "@/domain/localised";
import { formatAbsoluteMinute, formatRelativeTime } from "@/domain/relative-time";
import { renderArticleBody } from "@/editor/render/render-article";
import { imageSrcset } from "@/editor/render/image-srcset";
import { listTags } from "@/services/tags";
import type { AuthorAuthContext } from "@/services/auth";
import {
  addPostTranslation,
  archivePost,
  createPostDraft,
  deletePostPermanently,
  getPost,
  listPosts,
  publishPost,
  readFeedPage,
  removePostTranslation,
  setPostDefaultLocale,
  savePostTranslation,
  setPostImages,
  setPostTags,
  unarchivePost,
  type PostContext,
  type PostDetail,
  type PostMutation,
  type PostMutationFailure,
} from "@/services/posts";
import {
  compact,
  isAuthorizedAuthor,
  jsonError,
  jsonOk,
  NO_STORE,
  publishTimeFromBody,
  readBaseVersion,
  readIdList,
  readJsonObject,
  readLocale,
  readOptionalString,
} from "./admin-json";

const MUTATION_STATUS: Record<PostMutationFailure["reason"], number> = {
  "not-found": 404,
  "duplicate-locale": 409,
  "invalid-locale": 400,
  "invalid-publish-time": 400,
  "unknown-tag": 400,
  "unknown-asset": 400,
  "default-locale": 409,
  "last-translation": 409,
  "not-published": 409,
  "not-archived": 409,
  "stale-content": 409,
};

function mutationResponse(outcome: PostMutation): Response {
  if (outcome.ok) {
    return jsonOk({ post: outcome.post });
  }
  if (outcome.reason === "stale-content") {
    // The refused save's concurrency payload: the composer is shown this copy.
    return jsonOk(
      { error: outcome.reason, current: outcome.current },
      MUTATION_STATUS[outcome.reason],
    );
  }
  return jsonError(outcome.reason, MUTATION_STATUS[outcome.reason]);
}

function unauthorized(auth: AuthorAuthContext, request: Request): Response | null {
  return isAuthorizedAuthor(auth, request) ? null : jsonError("unauthorized", 401);
}

/**
 * The body a composer sends: the ProseMirror JSON and nothing else. The derived
 * Markdown column belongs to the service that writes the row, so a
 * client-supplied value can never reach it.
 */
function bodyInput(body: Record<string, unknown>): { bodyJson?: string } {
  return { bodyJson: readOptionalString(body, "bodyJson") };
}

export async function listPostsResponse(
  posts: PostContext,
  auth: AuthorAuthContext,
  request: Request,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  return jsonOk({ posts: await listPosts(posts) });
}

export async function createPostResponse(
  posts: PostContext,
  auth: AuthorAuthContext,
  request: Request,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const body = await readJsonObject(request);
  if (body === null) {
    return jsonError("invalid-json", 400);
  }

  const locale = body.locale === undefined ? siteConfig.defaultLocale : readLocale(body.locale);
  if (locale === null) {
    return jsonError("invalid-locale", 400);
  }
  const defaultLocale =
    body.defaultLocale === undefined ? undefined : readLocale(body.defaultLocale);
  if (defaultLocale === null) {
    return jsonError("invalid-locale", 400);
  }

  const created: PostDetail = await createPostDraft(
    posts,
    compact({ locale, defaultLocale, ...bodyInput(body) }),
  );

  return jsonOk({ post: created }, 201);
}

export async function getPostResponse(
  posts: PostContext,
  auth: AuthorAuthContext,
  request: Request,
  postId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const detail = await getPost(posts, postId);
  if (detail === null) {
    return jsonError("not-found", 404);
  }
  return jsonOk({ post: detail });
}

/** What the composer may change without touching the body: the Tags, and which Locale is default. */
export async function updatePostResponse(
  posts: PostContext,
  auth: AuthorAuthContext,
  request: Request,
  postId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const body = await readJsonObject(request);
  if (body === null) {
    return jsonError("invalid-json", 400);
  }

  let tagIds: string[] | undefined;
  if (body.tagIds !== undefined) {
    const read = readIdList(body, "tagIds");
    if (read === null) {
      return jsonError("invalid-tag-ids", 400);
    }
    tagIds = read;
  }

  const defaultLocale =
    body.defaultLocale === undefined ? undefined : readLocale(body.defaultLocale);
  if (defaultLocale === null) {
    return jsonError("invalid-locale", 400);
  }

  if (tagIds === undefined && defaultLocale === undefined) {
    // Tags and the default Locale are the only things a PATCH may change; a
    // body without either asks for nothing.
    return jsonError("invalid-tag-ids", 400);
  }

  // One call per field, in a fixed order, so neither change can undo the other.
  let outcome: PostMutation | null = null;
  if (tagIds !== undefined) {
    outcome = await setPostTags(posts, { postId, tagIds });
    if (!outcome.ok) {
      return mutationResponse(outcome);
    }
  }
  if (defaultLocale !== undefined) {
    outcome = await setPostDefaultLocale(posts, { postId, defaultLocale });
  }
  if (outcome === null) {
    // Unreachable: the guard above refuses a body that asks for nothing.
    return jsonError("invalid-tag-ids", 400);
  }

  return mutationResponse(outcome);
}

export async function deletePostResponse(
  posts: PostContext,
  auth: AuthorAuthContext,
  request: Request,
  postId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const outcome = await deletePostPermanently(posts, postId);
  if (!outcome.deleted) {
    return jsonError(outcome.reason, 404);
  }
  return new Response(null, { status: 204, headers: NO_STORE });
}

export async function addPostTranslationResponse(
  posts: PostContext,
  auth: AuthorAuthContext,
  request: Request,
  postId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const body = await readJsonObject(request);
  if (body === null) {
    return jsonError("invalid-json", 400);
  }
  const locale = readLocale(body.locale);
  if (locale === null) {
    return jsonError("invalid-locale", 400);
  }

  return mutationResponse(
    await addPostTranslation(posts, { postId, locale, ...bodyInput(body) }),
  );
}

export async function savePostTranslationResponse(
  posts: PostContext,
  auth: AuthorAuthContext,
  request: Request,
  postId: string,
  locale: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }
  if (!isLocale(locale)) {
    return jsonError("invalid-locale", 400);
  }

  const body = await readJsonObject(request);
  if (body === null) {
    return jsonError("invalid-json", 400);
  }
  const baseVersion = readBaseVersion(body);
  if (baseVersion === null) {
    return jsonError("invalid-base-version", 400);
  }

  return mutationResponse(
    await savePostTranslation(posts, { postId, locale, baseVersion, ...bodyInput(body) }),
  );
}

export async function removePostTranslationResponse(
  posts: PostContext,
  auth: AuthorAuthContext,
  request: Request,
  postId: string,
  locale: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }
  if (!isLocale(locale)) {
    return jsonError("invalid-locale", 400);
  }

  return mutationResponse(await removePostTranslation(posts, { postId, locale }));
}

export async function setPostImagesResponse(
  posts: PostContext,
  auth: AuthorAuthContext,
  request: Request,
  postId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const body = await readJsonObject(request);
  if (body === null) {
    return jsonError("invalid-json", 400);
  }
  const assetIds = readIdList(body, "assetIds");
  if (assetIds === null) {
    return jsonError("invalid-asset-ids", 400);
  }

  return mutationResponse(await setPostImages(posts, { postId, assetIds }));
}

export async function publicationResponse(
  posts: PostContext,
  auth: AuthorAuthContext,
  request: Request,
  postId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const body = await readJsonObject(request);
  if (body === null) {
    return jsonError("invalid-json", 400);
  }

  switch (body.action) {
    case "publish":
      return mutationResponse(
        await publishPost(posts, { postId, publishTime: publishTimeFromBody(body.publishTime) }),
      );
    case "archive":
      return mutationResponse(await archivePost(posts, { postId }));
    case "unarchive":
      return mutationResponse(await unarchivePost(posts, { postId }));
    default:
      return jsonError("invalid-action", 400);
  }
}

/**
 * One Feed card, rendered.
 *
 * The relative time is formatted *here*, once, on the server: the card receives
 * a finished label and a machine-readable instant, so nothing in the browser
 * ever recomputes it. The body goes through the same renderer as an Article
 * body; only the image presentation differs, and that difference lives in CSS
 * (the Feed crops cells to a viewport-relative aspect box, Articles keep the
 * original ratio).
 */
export async function feedView(
  posts: PostContext,
  input: {
    locale: (typeof siteConfig.locales)[number];
    tagSlug?: string | null;
    cursor?: FeedCursor | null;
    pageSize?: number;
  },
): Promise<FeedView> {
  const now = posts.clock.now();
  const [page, tags] = await Promise.all([
    readFeedPage(posts, input),
    input.tagSlug === undefined || input.tagSlug === null ? Promise.resolve([]) : listTags(posts),
  ]);

  const cards = await Promise.all(
    page.posts.map(async (post) => ({
      id: post.id,
      publishTime: post.publishTime,
      relativeTime: formatRelativeTime(post.publishTime, now, input.locale),
      absoluteTime: formatAbsoluteMinute(post.publishTime),
      bodyHtml: await renderArticleBody(post.bodyJson),
      images: post.images.map((image) => ({
        src: image.src,
        srcset: imageSrcset(image.src),
        original: image.original,
        alt: image.alt,
        width: image.width,
        height: image.height,
      })),
      tags: post.tags,
    })),
  );

  const tagSlug = input.tagSlug ?? null;
  const tag =
    tagSlug === null
      ? null
      : (() => {
          const found = tags.find((candidate) => candidate.slug === tagSlug);
          return found === undefined
            ? { slug: tagSlug, name: tagSlug }
            : { slug: found.slug, name: pickLocalised(found.names, input.locale, found.slug) };
        })();

  return {
    posts: cards,
    nextCursor: page.nextCursor === null ? null : encodeFeedCursor(page.nextCursor),
    tag,
  };
}

/**
 * `GET /api/public/feed` — the page behind "load older".
 *
 * No session: this is a Reader surface. The first page is never fetched here,
 * because the Feed page renders it itself; this endpoint only ever answers a
 * page after the cursor.
 */
export async function feedResponse(posts: PostContext, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const locale = readLocale(url.searchParams.get("locale"));
  if (locale === null) {
    return jsonError("invalid-locale", 400);
  }

  const rawCursor = url.searchParams.get("cursor");
  const cursor = rawCursor === null || rawCursor.length === 0 ? null : decodeFeedCursor(rawCursor);
  if (rawCursor !== null && rawCursor.length > 0 && cursor === null) {
    return jsonError("invalid-cursor", 400);
  }

  const tagSlug = url.searchParams.get("tag");
  const view = await feedView(posts, {
    locale,
    tagSlug: tagSlug === null || tagSlug.length === 0 ? null : tagSlug,
    cursor,
    pageSize: normaliseFeedPageSize(url.searchParams.get("limit") ?? FEED_PAGE_SIZE),
  });

  return Response.json(view, { headers: NO_STORE });
}
