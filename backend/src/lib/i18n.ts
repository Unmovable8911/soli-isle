import { eq } from 'drizzle-orm';
import { languages } from '../db/schema/index.js';
import type { createDb } from '../db/index.js';

type Db = ReturnType<typeof createDb>;

export interface LanguageRef {
  code: string;
  id: string;
}

export interface ResolvedLanguages {
  /** The language to show, if a translation for it exists. */
  active: LanguageRef;
  /** The default language to fall back to when the active translation is missing. */
  fallback: LanguageRef;
}

/**
 * Resolve the active language plus the default-language fallback for a request.
 *
 * `active` is the requested language when it exists in the `languages` table,
 * otherwise the default language. `fallback` is always the default language
 * (or, if none is marked default, the first configured language). Public
 * endpoints select translations for BOTH and prefer `active` per-item, so an
 * item with no translation in the active language falls back to the default
 * language instead of disappearing.
 */
export async function resolveLanguages(
  db: Db,
  requestedLang: string | undefined
): Promise<ResolvedLanguages> {
  const all = await db.select().from(languages);
  if (all.length === 0) throw new Error('No languages configured');

  const def = all.find(l => l.is_default === 1) ?? all[0]!;
  const active = (requestedLang ? all.find(l => l.code === requestedLang) : undefined) ?? def;

  return {
    active: { id: active.id, code: active.code },
    fallback: { id: def.id, code: def.code },
  };
}

/**
 * Resolve a single language id/code: the requested language if configured,
 * else the default language, else the first configured language.
 */
export async function resolveLanguage(
  db: Db,
  requestedLang: string | undefined
): Promise<LanguageRef> {
  if (requestedLang) {
    const rows = await db.select().from(languages).where(eq(languages.code, requestedLang));
    if (rows.length > 0) return { code: rows[0]!.code, id: rows[0]!.id };
  }
  const defaults = await db.select().from(languages).where(eq(languages.is_default, 1));
  if (defaults[0]) return { code: defaults[0].code, id: defaults[0].id };
  const all = await db.select().from(languages);
  if (all[0]) return { code: all[0].code, id: all[0].id };
  throw new Error('No languages configured');
}
