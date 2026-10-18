import { asc, eq, inArray } from "drizzle-orm";

import type { DatabaseConnection } from "@/db/database";
import { category, categoryTranslation } from "@/db/schema";
import type { Locale } from "@/config/site";
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
    const siblings = db.select({ position: category.position }).from(category).all();
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
