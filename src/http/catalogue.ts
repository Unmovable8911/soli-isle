import { isLocale } from "@/config/site";
import type { AuthorAuthContext } from "@/services/auth";
import {
  createCategory,
  listCategoryTree,
  type CategoryContext,
} from "@/services/categories";
import { createTag, listTags, type TagContext } from "@/services/tags";
import { isAuthorizedAuthor, jsonError, jsonOk, readJsonObject } from "./admin-json";

function unauthorized(auth: AuthorAuthContext, request: Request): Response | null {
  return isAuthorizedAuthor(auth, request) ? null : jsonError("unauthorized", 401);
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
