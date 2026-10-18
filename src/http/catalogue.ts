import { isLocale } from "@/config/site";
import type { AuthorAuthContext } from "@/services/auth";
import {
  createCategory,
  deleteCategory,
  listCategoryTree,
  moveCategory,
  reorderCategory,
  setCategoryName,
  type CategoryContext,
} from "@/services/categories";
import {
  createTag,
  deleteTag,
  listTags,
  setTagName,
  type TagContext,
} from "@/services/tags";
import {
  isAuthorizedAuthor,
  jsonError,
  jsonOk,
  NO_STORE,
  readJsonObject,
} from "./admin-json";

function unauthorized(auth: AuthorAuthContext, request: Request): Response | null {
  return isAuthorizedAuthor(auth, request) ? null : jsonError("unauthorized", 401);
}

/** Every Category write answers with the whole tree: a move rewrites many paths. */
async function treeResponse(categories: CategoryContext): Promise<Response> {
  return jsonOk({ categories: await listCategoryTree(categories) });
}

export async function listCategoriesResponse(
  categories: CategoryContext,
  auth: AuthorAuthContext,
  request: Request,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  return jsonOk({ categories: await listCategoryTree(categories) });
}

export async function createCategoryResponse(
  categories: CategoryContext,
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
  const locale = typeof body.locale === "string" ? body.locale : null;
  if (locale === null || !isLocale(locale)) {
    return jsonError("invalid-locale", 400);
  }
  if (typeof body.name !== "string") {
    return jsonError("invalid-name", 400);
  }

  const outcome = await createCategory(categories, {
    locale,
    name: body.name,
    parentId: typeof body.parentId === "string" ? body.parentId : null,
    slug: typeof body.slug === "string" ? body.slug : undefined,
  });

  if (!outcome.ok) {
    return jsonError(outcome.reason, outcome.reason === "duplicate-slug" ? 409 : 400);
  }
  return jsonOk({ category: outcome.category }, 201);
}

export async function listTagsResponse(
  tags: TagContext,
  auth: AuthorAuthContext,
  request: Request,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  return jsonOk({ tags: await listTags(tags) });
}

export async function createTagResponse(
  tags: TagContext,
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
  const locale = typeof body.locale === "string" ? body.locale : null;
  if (locale === null || !isLocale(locale)) {
    return jsonError("invalid-locale", 400);
  }
  if (typeof body.name !== "string") {
    return jsonError("invalid-name", 400);
  }

  const outcome = await createTag(tags, {
    locale,
    name: body.name,
    slug: typeof body.slug === "string" ? body.slug : undefined,
  });

  if (!outcome.ok) {
    return jsonError(outcome.reason, 400);
  }
  return jsonOk({ tag: outcome.tag }, 201);
}

/**
 * One Category, three operations. A rename touches a display name for one
 * Locale, a move re-parents the subtree, a reorder swaps two siblings; the
 * body always names which one it is, so a request can never half-do two.
 */
export async function updateCategoryResponse(
  categories: CategoryContext,
  auth: AuthorAuthContext,
  request: Request,
  categoryId: string,
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
    case "rename": {
      const locale = typeof body.locale === "string" ? body.locale : null;
      if (locale === null || !isLocale(locale)) {
        return jsonError("invalid-locale", 400);
      }
      if (typeof body.name !== "string") {
        return jsonError("invalid-name", 400);
      }
      const outcome = await setCategoryName(categories, {
        categoryId,
        locale,
        name: body.name,
      });
      if (!outcome.ok) {
        return jsonError(outcome.reason, outcome.reason === "not-found" ? 404 : 400);
      }
      return treeResponse(categories);
    }
    case "move": {
      if (!("parentId" in body)) {
        return jsonError("invalid-parent", 400);
      }
      const parentId = body.parentId;
      if (parentId !== null && typeof parentId !== "string") {
        return jsonError("invalid-parent", 400);
      }
      const outcome = await moveCategory(categories, { categoryId, parentId });
      if (!outcome.ok) {
        return jsonError(outcome.reason, categoryStatus(outcome.reason));
      }
      return treeResponse(categories);
    }
    case "reorder": {
      if (body.direction !== "up" && body.direction !== "down") {
        return jsonError("invalid-direction", 400);
      }
      const outcome = await reorderCategory(categories, {
        categoryId,
        direction: body.direction,
      });
      if (!outcome.ok) {
        return jsonError(outcome.reason, categoryStatus(outcome.reason));
      }
      return treeResponse(categories);
    }
    default:
      return jsonError("invalid-action", 400);
  }
}

function categoryStatus(reason: string): number {
  switch (reason) {
    case "not-found":
      return 404;
    case "duplicate-slug":
    case "cyclic-move":
    case "no-sibling":
      return 409;
    default:
      return 400;
  }
}

/**
 * `?moveArticlesTo=<categoryId>` is the Author's answer to "this Category is
 * still in use". Without it the delete is refused and the count reported.
 */
export async function deleteCategoryResponse(
  categories: CategoryContext,
  auth: AuthorAuthContext,
  request: Request,
  categoryId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const moveArticlesTo = new URL(request.url).searchParams.get("moveArticlesTo") ?? undefined;
  const outcome = await deleteCategory(categories, { categoryId, moveArticlesTo });

  if (outcome.ok) {
    return jsonOk({ movedArticles: outcome.movedArticles });
  }
  switch (outcome.reason) {
    case "not-found":
      return jsonError("not-found", 404);
    case "has-children":
      return jsonOk({ error: "has-children", childCount: outcome.childCount }, 409);
    case "in-use":
      return jsonOk({ error: "in-use", articleCount: outcome.articleCount }, 409);
    default:
      return jsonError("unknown-destination", 400);
  }
}

export async function updateTagResponse(
  tags: TagContext,
  auth: AuthorAuthContext,
  request: Request,
  tagId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const body = await readJsonObject(request);
  if (body === null) {
    return jsonError("invalid-json", 400);
  }
  if (body.action !== "rename") {
    return jsonError("invalid-action", 400);
  }

  const locale = typeof body.locale === "string" ? body.locale : null;
  if (locale === null || !isLocale(locale)) {
    return jsonError("invalid-locale", 400);
  }
  if (typeof body.name !== "string") {
    return jsonError("invalid-name", 400);
  }

  const outcome = await setTagName(tags, { tagId, locale, name: body.name });
  if (!outcome.ok) {
    return jsonError(outcome.reason, outcome.reason === "not-found" ? 404 : 400);
  }
  return jsonOk({ tag: outcome.tag });
}

export async function deleteTagResponse(
  tags: TagContext,
  auth: AuthorAuthContext,
  request: Request,
  tagId: string,
): Promise<Response> {
  const denied = unauthorized(auth, request);
  if (denied !== null) {
    return denied;
  }

  const outcome = await deleteTag(tags, { tagId });
  if (outcome.ok) {
    return new Response(null, { status: 204, headers: NO_STORE });
  }
  if (outcome.reason === "in-use") {
    return jsonOk(
      { error: "in-use", articleCount: outcome.articleCount, postCount: outcome.postCount },
      409,
    );
  }
  return jsonError("not-found", 404);
}
