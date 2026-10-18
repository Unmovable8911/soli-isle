import { asc, eq, inArray } from "drizzle-orm";

import type { Locale } from "@/config/site";
import type { DatabaseConnection } from "@/db/database";
import { tag, tagTranslation } from "@/db/schema";
import type { Clock } from "@/domain/clock";
import { normaliseSlug } from "@/domain/slug";
import { generateUlid } from "@/domain/ulid";

export interface TagContext {
  database: DatabaseConnection;
  clock: Clock;
}

export interface TagView {
  id: string;
  slug: string;
  names: Partial<Record<Locale, string>>;
}

export type CreateTagOutcome =
  | { ok: true; tag: TagView }
  | { ok: false; reason: "invalid-name" };

export function createTagContext(database: DatabaseConnection, clock: Clock): TagContext {
  return { database, clock };
}

type TagRow = typeof tag.$inferSelect;
type TagTranslationRow = typeof tagTranslation.$inferSelect;

function namesOf(rows: TagTranslationRow[]): Partial<Record<Locale, string>> {
  const names: Partial<Record<Locale, string>> = {};
  for (const row of rows) {
    names[row.locale] = row.name;
  }
  return names;
}

function translationsByTag(rows: TagTranslationRow[]): Map<string, TagTranslationRow[]> {
  const grouped = new Map<string, TagTranslationRow[]>();
  for (const row of rows) {
    const group = grouped.get(row.tagId);
    if (group === undefined) {
      grouped.set(row.tagId, [row]);
    } else {
      group.push(row);
    }
  }
  return grouped;
}

function toView(row: TagRow, names: Partial<Record<Locale, string>>): TagView {
  return { id: row.id, slug: row.slug, names };
}

export function loadTagViews(
  ctx: TagContext,
  tagIds: readonly string[],
): Map<string, TagView> {
  const ids = [...new Set(tagIds)];
  if (ids.length === 0) {
    return new Map();
  }

  const db = ctx.database.db;
  const rows = db.select().from(tag).where(inArray(tag.id, ids)).orderBy(asc(tag.slug)).all();
  const translations = db
    .select()
    .from(tagTranslation)
    .where(inArray(tagTranslation.tagId, ids))
    .orderBy(asc(tagTranslation.locale))
    .all();

  const grouped = translationsByTag(translations);
  return new Map(rows.map((row) => [row.id, toView(row, namesOf(grouped.get(row.id) ?? []))]));
}

/**
 * Creating a Tag with the Slug of an existing Tag adds this Locale's name to
 * that Tag instead of failing — inline creation while writing must be
 * idempotent enough to type the same topic twice.
 */
export async function createTag(
  ctx: TagContext,
  input: { slug?: string; locale: Locale; name: string },
): Promise<CreateTagOutcome> {
  const name = input.name.trim();
  if (name.length === 0) {
    return { ok: false, reason: "invalid-name" };
  }

  const db = ctx.database.db;
  const slug = normaliseSlug(input.slug ?? name);
  const existing = db.select().from(tag).where(eq(tag.slug, slug)).get();

  if (existing !== undefined) {
    db.insert(tagTranslation)
      .values({ tagId: existing.id, locale: input.locale, name })
      .onConflictDoUpdate({
        target: [tagTranslation.tagId, tagTranslation.locale],
        set: { name },
      })
      .run();

    const translations = db
      .select()
      .from(tagTranslation)
      .where(eq(tagTranslation.tagId, existing.id))
      .orderBy(asc(tagTranslation.locale))
      .all();

    return { ok: true, tag: toView(existing, namesOf(translations)) };
  }

  const tagId = generateUlid(ctx.clock.now());
  const createdAt = ctx.clock.now().toISOString();
  db.transaction((tx) => {
    tx.insert(tag).values({ id: tagId, slug, createdAt }).run();
    tx.insert(tagTranslation).values({ tagId, locale: input.locale, name }).run();
  });

  return { ok: true, tag: { id: tagId, slug, names: { [input.locale]: name } } };
}

export async function listTags(ctx: TagContext): Promise<TagView[]> {
  const db = ctx.database.db;
  const rows = db.select().from(tag).orderBy(asc(tag.slug)).all();
  const translations = db
    .select()
    .from(tagTranslation)
    .orderBy(asc(tagTranslation.locale))
    .all();
  const grouped = translationsByTag(translations);

  return rows.map((row) => toView(row, namesOf(grouped.get(row.id) ?? [])));
}
