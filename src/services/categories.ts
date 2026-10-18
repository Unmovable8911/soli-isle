import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";

import type { DatabaseConnection } from "@/db/database";
import { article, category, categoryTranslation } from "@/db/schema";
import type { Locale } from "@/config/site";
import { rebaseCategoryPath } from "@/domain/category-path";
import { normaliseSlug } from "@/domain/slug";
import type { Clock } from "@/domain/clock";
import { generateUlid } from "@/domain/ulid";

export interface CategoryContext {
  database: DatabaseConnection;
  clock: Clock;
}

export interface CategoryView {
  id: string;
  parentId: string | null;
  slug: string;
  path: string;
  position: number;
  names: Partial<Record<Locale, string>>;
}

export interface CategoryNode extends CategoryView {
  children: CategoryNode[];
}

export type CreateCategoryOutcome =
  | { ok: true; category: CategoryView }
  | { ok: false; reason: "invalid-name" | "duplicate-slug" | "unknown-parent" };

export type RenameCategoryOutcome =
  | { ok: true; category: CategoryView }
  | { ok: false; reason: "invalid-name" | "not-found" };

export type MoveCategoryOutcome =
  | { ok: true; category: CategoryView }
  | { ok: false; reason: "not-found" | "unknown-parent" | "cyclic-move" | "duplicate-slug" };

export type ReorderCategoryOutcome =
  | { ok: true; category: CategoryView }
  | { ok: false; reason: "not-found" | "no-sibling" };

/**
 * A Category is deleted only when nothing is left pointing at it: no child
 * Category (the tree would lose a branch, and `parent_id` refuses it anyway)
 * and no Article still filed under it. An Article that does use it is not
 * silently uncategorised — the Author either names the Category to move those
 * Articles to (`moveArticlesTo`) or the deletion is refused with the count.
 */
export type DeleteCategoryOutcome =
  | { ok: true; movedArticles: number }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "has-children"; childCount: number }
  | { ok: false; reason: "in-use"; articleCount: number }
  | { ok: false; reason: "unknown-destination" };

export function createCategoryContext(
  database: DatabaseConnection,
  clock: Clock,
): CategoryContext {
  return { database, clock };
}

type CategoryRow = typeof category.$inferSelect;
type CategoryTranslationRow = typeof categoryTranslation.$inferSelect;

function namesOf(rows: CategoryTranslationRow[]): Partial<Record<Locale, string>> {
  const names: Partial<Record<Locale, string>> = {};
  for (const row of rows) {
    names[row.locale] = row.name;
  }
  return names;
}

function toView(row: CategoryRow, names: Partial<Record<Locale, string>>): CategoryView {
  return {
    id: row.id,
    parentId: row.parentId,
    slug: row.slug,
    path: row.path,
    position: row.position,
    names,
  };
}

/** Bulk lookup so Article reads do not issue one query per Category. */
export function loadCategoryViews(
  ctx: CategoryContext,
  categoryIds: readonly string[],
): Map<string, CategoryView> {
  const ids = [...new Set(categoryIds)];
  if (ids.length === 0) {
    return new Map();
  }

  const db = ctx.database.db;
  const rows = db.select().from(category).where(inArray(category.id, ids)).all();
  const translations = db
    .select()
    .from(categoryTranslation)
    .where(inArray(categoryTranslation.categoryId, ids))
    .orderBy(asc(categoryTranslation.locale))
    .all();

  const translationsByCategory = new Map<string, CategoryTranslationRow[]>();
  for (const row of translations) {
    const group = translationsByCategory.get(row.categoryId);
    if (group === undefined) {
      translationsByCategory.set(row.categoryId, [row]);
    } else {
      group.push(row);
    }
  }

  return new Map(
    rows.map((row) => [row.id, toView(row, namesOf(translationsByCategory.get(row.id) ?? []))]),
  );
}

export async function createCategory(
  ctx: CategoryContext,
  input: { parentId?: string | null; slug?: string; locale: Locale; name: string },
): Promise<CreateCategoryOutcome> {
  const name = input.name.trim();
  if (name.length === 0) {
    return { ok: false, reason: "invalid-name" };
  }

  const db = ctx.database.db;
  const parentId = input.parentId ?? null;
  let parentPath: string | null = null;
  let position = 0;

  if (parentId === null) {
    const siblings = db
      .select({ position: category.position })
      .from(category)
      .where(isNull(category.parentId))
      .all();
    position = siblings.reduce((highest, row) => Math.max(highest, row.position + 1), 0);
  } else {
    const parent = db.select().from(category).where(eq(category.id, parentId)).get();
    if (parent === undefined) {
      return { ok: false, reason: "unknown-parent" };
    }
    parentPath = parent.path;
    const siblings = db
      .select({ position: category.position })
      .from(category)
      .where(eq(category.parentId, parentId))
      .all();
    position = siblings.reduce((highest, row) => Math.max(highest, row.position + 1), 0);
  }

  const slug = normaliseSlug(input.slug ?? name);
  const path = parentPath === null ? slug : `${parentPath}/${slug}`;
  const existing = db.select({ id: category.id }).from(category).where(eq(category.path, path)).get();
  if (existing !== undefined) {
    return { ok: false, reason: "duplicate-slug" };
  }

  const categoryId = generateUlid(ctx.clock.now());
  const createdAt = ctx.clock.now().toISOString();

  db.transaction((tx) => {
    tx.insert(category)
      .values({ id: categoryId, parentId, slug, path, position, createdAt })
      .run();
    tx.insert(categoryTranslation)
      .values({ categoryId, locale: input.locale, name })
      .run();
  });

  return {
    ok: true,
    category: {
      id: categoryId,
      parentId,
      slug,
      path,
      position,
      names: { [input.locale]: name },
    },
  };
}

export async function listCategoryTree(ctx: CategoryContext): Promise<CategoryNode[]> {
  const db = ctx.database.db;
  const rows = db
    .select()
    .from(category)
    .orderBy(asc(category.position), asc(category.path))
    .all();
  const translations = db
    .select()
    .from(categoryTranslation)
    .orderBy(asc(categoryTranslation.locale))
    .all();

  const translationsByCategory = new Map<string, CategoryTranslationRow[]>();
  for (const row of translations) {
    const group = translationsByCategory.get(row.categoryId);
    if (group === undefined) {
      translationsByCategory.set(row.categoryId, [row]);
    } else {
      group.push(row);
    }
  }

  const nodes = new Map<string, CategoryNode>(
    rows.map((row) => [
      row.id,
      { ...toView(row, namesOf(translationsByCategory.get(row.id) ?? [])), children: [] },
    ]),
  );

  const roots: CategoryNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (node === undefined) {
      continue;
    }
    const parent = row.parentId === null ? undefined : nodes.get(row.parentId);
    if (parent === undefined) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }

  return roots;
}

/** A display name is per Locale and never touches the locale-neutral Slug path. */
export async function setCategoryName(
  ctx: CategoryContext,
  input: { categoryId: string; locale: Locale; name: string },
): Promise<RenameCategoryOutcome> {
  const name = input.name.trim();
  if (name.length === 0) {
    return { ok: false, reason: "invalid-name" };
  }

  const db = ctx.database.db;
  const existing = db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.id, input.categoryId))
    .get();
  if (existing === undefined) {
    return { ok: false, reason: "not-found" };
  }

  db.insert(categoryTranslation)
    .values({ categoryId: input.categoryId, locale: input.locale, name })
    .onConflictDoUpdate({
      target: [categoryTranslation.categoryId, categoryTranslation.locale],
      set: { name },
    })
    .run();

  return { ok: true, category: view(ctx, input.categoryId) };
}

function view(ctx: CategoryContext, categoryId: string): CategoryView {
  const found = loadCategoryViews(ctx, [categoryId]).get(categoryId);
  if (found === undefined) {
    throw new Error("The category could not be read back after the write");
  }
  return found;
}

/**
 * Re-parents a Category and rebuilds every path in the moved subtree. The Slug
 * is locale-neutral and permanent, so a move changes the prefix only.
 */
export async function moveCategory(
  ctx: CategoryContext,
  input: { categoryId: string; parentId: string | null },
): Promise<MoveCategoryOutcome> {
  const db = ctx.database.db;
  const node = db.select().from(category).where(eq(category.id, input.categoryId)).get();
  if (node === undefined) {
    return { ok: false, reason: "not-found" };
  }

  let parentPath: string | null = null;
  if (input.parentId !== null) {
    const parent = db.select().from(category).where(eq(category.id, input.parentId)).get();
    if (parent === undefined) {
      return { ok: false, reason: "unknown-parent" };
    }
    // A Category cannot hang off itself or off its own subtree.
    if (parent.id === node.id || parent.path.startsWith(`${node.path}/`)) {
      return { ok: false, reason: "cyclic-move" };
    }
    parentPath = parent.path;
  }

  const path = parentPath === null ? node.slug : `${parentPath}/${node.slug}`;
  if (path === node.path) {
    return { ok: true, category: view(ctx, node.id) };
  }

  const subtree = db.select().from(category).all();
  const moved = subtree.filter(
    (row) => row.id === node.id || row.path.startsWith(`${node.path}/`),
  );
  const movedIds = new Set(moved.map((row) => row.id));
  const rebased = new Map(
    moved.map((row) => [row.id, rebaseCategoryPath(row.path, node.path, path)]),
  );

  const taken = new Set(
    subtree.filter((row) => !movedIds.has(row.id)).map((row) => row.path),
  );
  if (taken.has(path) || [...rebased.values()].some((candidate) => taken.has(candidate))) {
    return { ok: false, reason: "duplicate-slug" };
  }

  // The moved Category goes to the end of its new siblings, and that level's
  // positions are rewritten as 0..n-1 so two siblings never share one.
  const destination = subtree
    .filter((row) => !movedIds.has(row.id) && row.parentId === input.parentId)
    .sort((left, right) => left.position - right.position || left.path.localeCompare(right.path))
    .map((row) => row.id);
  const order = [...destination, node.id];

  db.transaction((tx) => {
    for (const row of moved) {
      tx.update(category)
        .set({
          path: rebased.get(row.id) ?? row.path,
          ...(row.id === node.id ? { parentId: input.parentId } : {}),
        })
        .where(eq(category.id, row.id))
        .run();
    }
    order.forEach((id, position) => {
      tx.update(category).set({ position }).where(eq(category.id, id)).run();
    });
  });

  return { ok: true, category: view(ctx, node.id) };
}

/** Swaps a Category with the sibling immediately above or below it. */
export async function reorderCategory(
  ctx: CategoryContext,
  input: { categoryId: string; direction: "up" | "down" },
): Promise<ReorderCategoryOutcome> {
  const db = ctx.database.db;
  const node = db.select().from(category).where(eq(category.id, input.categoryId)).get();
  if (node === undefined) {
    return { ok: false, reason: "not-found" };
  }

  const siblings = db
    .select({ id: category.id })
    .from(category)
    .where(
      node.parentId === null ? isNull(category.parentId) : eq(category.parentId, node.parentId),
    )
    .orderBy(asc(category.position), asc(category.path))
    .all()
    .map((row) => row.id);

  const index = siblings.indexOf(node.id);
  const target = input.direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= siblings.length) {
    return { ok: false, reason: "no-sibling" };
  }

  const other = siblings[target];
  if (other === undefined) {
    return { ok: false, reason: "no-sibling" };
  }
  siblings[target] = node.id;
  siblings[index] = other;

  db.transaction((tx) => {
    siblings.forEach((id, position) => {
      tx.update(category).set({ position }).where(eq(category.id, id)).run();
    });
  });

  return { ok: true, category: view(ctx, node.id) };
}

export async function deleteCategory(
  ctx: CategoryContext,
  input: { categoryId: string; moveArticlesTo?: string },
): Promise<DeleteCategoryOutcome> {
  const db = ctx.database.db;
  const node = db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.id, input.categoryId))
    .get();
  if (node === undefined) {
    return { ok: false, reason: "not-found" };
  }

  const childCount = db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.parentId, input.categoryId))
    .all().length;
  if (childCount > 0) {
    return { ok: false, reason: "has-children", childCount };
  }

  const articleCount = db
    .select({ id: article.id })
    .from(article)
    .where(eq(article.categoryId, input.categoryId))
    .all().length;

  if (input.moveArticlesTo === undefined) {
    if (articleCount > 0) {
      return { ok: false, reason: "in-use", articleCount };
    }
    db.delete(category).where(eq(category.id, input.categoryId)).run();
    return { ok: true, movedArticles: 0 };
  }

  const destination = db
    .select({ id: category.id })
    .from(category)
    .where(and(eq(category.id, input.moveArticlesTo), ne(category.id, input.categoryId)))
    .get();
  if (destination === undefined) {
    return { ok: false, reason: "unknown-destination" };
  }

  db.transaction((tx) => {
    if (articleCount > 0) {
      tx.update(article)
        .set({ categoryId: destination.id })
        .where(eq(article.categoryId, input.categoryId))
        .run();
    }
    tx.delete(category).where(eq(category.id, input.categoryId)).run();
  });

  return { ok: true, movedArticles: articleCount };
}
