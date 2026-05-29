import { eq } from 'drizzle-orm';
import { languages } from '../db/schema/index.js';
import type { createDb } from '../db/index.js';

type Db = ReturnType<typeof createDb>;

export async function resolveLanguage(
  db: Db,
  requestedLang: string | undefined
): Promise<{ code: string; id: string }> {
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
