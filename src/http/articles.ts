import { isLocale, siteConfig } from "@/config/site";
import { isRichTextDocument } from "@/domain/rich-text";
import { deriveMarkdown } from "@/editor/markdown";
import { renderArticleBody } from "@/editor/render/render-article";
import type { AuthorAuthContext } from "@/services/auth";
import {
  addArticleTranslation,
  archiveArticle,
  captureAutomaticRevision,
  createArticleDraft,
  deleteArticlePermanently,
  getArticle,
  listArticles,
  listRevisions,
  publishArticle,
  removeArticleTranslation,
  restoreRevision,
  saveArticleTranslation,
  unarchiveArticle,
  updateArticleMeta,
  type ArticleDetail,
  type ArticleMutation,
  type ArticleMutationFailure,
  type ArticleContext,
} from "@/services/articles";
import {
  compact,
  isAuthorizedAuthor,
  jsonError,
  jsonOk,
  publishTimeFromBody,
  readBaseVersion,
  readJsonObject,
  readLocale,
  readOptionalString,
} from "./admin-json";

const MUTATION_STATUS: Record<ArticleMutationFailure["reason"], number> = {
  "not-found": 404,
  "duplicate-locale": 409,
  "duplicate-slug": 409,
  "invalid-slug": 400,
  "invalid-locale": 400,
  "invalid-publish-time": 400,
  "unknown-category": 400,
  "unknown-tag": 400,
  "default-locale": 409,
  "last-translation": 409,
  "not-published": 409,
  "not-archived": 409,
  "stale-content": 409,
};

function mutationResponse(outcome: ArticleMutation): Response {
  if (outcome.ok) {
    return jsonOk({ article: outcome.article });
  }
  if (outcome.reason === "stale-content") {
    // The refused save's concurrency payload: the Author is shown this copy.
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
 * The derived Markdown is always computed here from the ProseMirror JSON — a
 * client-supplied Markdown column is never trusted or accepted.
 */
function translationInput(
  body: Record<string, unknown>,
): { title?: string; summary?: string; bodyJson?: string; bodyMarkdown?: string } {
  const bodyJson = readOptionalString(body, "bodyJson");

  return {
    title: readOptionalString(body, "title"),
    summary: readOptionalString(body, "summary"),
    bodyJson,
    bodyMarkdown: bodyJson === undefined ? undefined : deriveMarkdown(bodyJson),
  };
}

export async function listArticlesResponse(
  articles: ArticleContext,
  auth: AuthorAuthContext,
  request: Request,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  return jsonOk({ articles: await listArticles(articles) });
}

export async function createArticleResponse(
  articles: ArticleContext,
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

  const created: ArticleDetail = await createArticleDraft(
    articles,
    compact({
      title: readOptionalString(body, "title") ?? "",
      locale,
      defaultLocale,
      slug: readOptionalString(body, "slug"),
      summary: readOptionalString(body, "summary"),
      bodyJson: readOptionalString(body, "bodyJson"),
      bodyMarkdown: readOptionalString(body, "bodyMarkdown"),
    }),
  );

  return jsonOk({ article: created }, 201);
}

export async function getArticleResponse(
  articles: ArticleContext,
  auth: AuthorAuthContext,
  request: Request,
  articleId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const detail = await getArticle(articles, articleId);
  if (detail === null) {
    return jsonError("not-found", 404);
  }
  return jsonOk({ article: detail });
}

export async function updateArticleResponse(
  articles: ArticleContext,
  auth: AuthorAuthContext,
  request: Request,
  articleId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const body = await readJsonObject(request);
  if (body === null) {
    return jsonError("invalid-json", 400);
  }

  const defaultLocale =
    body.defaultLocale === undefined ? undefined : readLocale(body.defaultLocale);
  if (defaultLocale === null) {
    return jsonError("invalid-locale", 400);
  }

  let tagIds: string[] | undefined;
  if (body.tagIds !== undefined) {
    if (!Array.isArray(body.tagIds) || body.tagIds.some((tagId) => typeof tagId !== "string")) {
      return jsonError("invalid-tag-ids", 400);
    }
    tagIds = body.tagIds as string[];
  }

  const outcome = await updateArticleMeta(
    articles,
    compact({
      articleId,
      slug: readOptionalString(body, "slug"),
      defaultLocale,
      categoryId: body.categoryId === undefined ? undefined : readCategoryId(body.categoryId),
      tagIds,
    }),
  );

  return mutationResponse(outcome);
}

function readCategoryId(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function deleteArticleResponse(
  articles: ArticleContext,
  auth: AuthorAuthContext,
  request: Request,
  articleId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const outcome = await deleteArticlePermanently(articles, articleId);
  if (!outcome.deleted) {
    return jsonError(outcome.reason, 404);
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

export async function addTranslationResponse(
  articles: ArticleContext,
  auth: AuthorAuthContext,
  request: Request,
  articleId: string,
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
    await addArticleTranslation(articles, { articleId, locale, ...translationInput(body) }),
  );
}

export async function saveTranslationResponse(
  articles: ArticleContext,
  auth: AuthorAuthContext,
  request: Request,
  articleId: string,
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
    await saveArticleTranslation(articles, {
      articleId,
      locale,
      baseVersion,
      ...translationInput(body),
    }),
  );
}

export async function removeTranslationResponse(
  articles: ArticleContext,
  auth: AuthorAuthContext,
  request: Request,
  articleId: string,
  locale: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }
  if (!isLocale(locale)) {
    return jsonError("invalid-locale", 400);
  }

  return mutationResponse(await removeArticleTranslation(articles, { articleId, locale }));
}

export async function publicationResponse(
  articles: ArticleContext,
  auth: AuthorAuthContext,
  request: Request,
  articleId: string,
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
        await publishArticle(articles, {
          articleId,
          publishTime: publishTimeFromBody(body.publishTime),
        }),
      );
    case "archive":
      return mutationResponse(await archiveArticle(articles, { articleId }));
    case "unarchive":
      return mutationResponse(await unarchiveArticle(articles, { articleId }));
    default:
      return jsonError("invalid-action", 400);
  }
}

/** Renders the unpublished form with the same renderer the public page uses. */
export async function previewArticleResponse(
  articles: ArticleContext,
  auth: AuthorAuthContext,
  request: Request,
  articleId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const detail = await getArticle(articles, articleId);
  if (detail === null) {
    return jsonError("not-found", 404);
  }

  const body = await readJsonObject(request);
  if (body === null) {
    return jsonError("invalid-json", 400);
  }

  const bodyJson = readOptionalString(body, "bodyJson") ?? detail.translations[0]?.bodyJson ?? "";
  if (!isRichTextDocument(bodyJson)) {
    return jsonError("invalid-body", 400);
  }

  return jsonOk({ html: await renderArticleBody(bodyJson) });
}

export async function listRevisionsResponse(
  articles: ArticleContext,
  auth: AuthorAuthContext,
  request: Request,
  articleId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  return jsonOk({ revisions: await listRevisions(articles, articleId) });
}

export async function captureRevisionResponse(
  articles: ArticleContext,
  auth: AuthorAuthContext,
  request: Request,
  articleId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const outcome = await captureAutomaticRevision(articles, { articleId });
  if (!outcome.ok) {
    return jsonError(outcome.reason, 404);
  }
  return jsonOk({ created: outcome.created });
}

export async function restoreRevisionResponse(
  articles: ArticleContext,
  auth: AuthorAuthContext,
  request: Request,
  articleId: string,
  revisionId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  return mutationResponse(await restoreRevision(articles, { articleId, revisionId }));
}
