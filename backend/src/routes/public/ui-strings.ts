import { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { uiTranslations, languages } from '../../db/schema/index.js';

export const publicUIStringsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/ui-strings', async (request, reply) => {
    const { lang } = request.query as { lang?: string };
    if (!lang) {
      return reply.status(400).send({ error: '?lang= parameter is required' });
    }

    const langRows = await app.db
      .select()
      .from(languages)
      .where(eq(languages.code, lang));

    if (langRows.length === 0) {
      return reply.status(404).send({ error: `Language not found: ${lang}` });
    }

    const langId = langRows[0]!.id;

    const rows = await app.db
      .select({ key: uiTranslations.key, value: uiTranslations.value })
      .from(uiTranslations)
      .where(eq(uiTranslations.language_id, langId));

    const defaultLang = await app.db
      .select()
      .from(languages)
      .where(eq(languages.is_default, 1));

    const defaultLangId = defaultLang[0]?.id;

    if (defaultLangId && defaultLangId !== langId) {
      const existingKeys = new Set(rows.map(r => r.key));
      const defaultRows = await app.db
        .select({ key: uiTranslations.key, value: uiTranslations.value })
        .from(uiTranslations)
        .where(eq(uiTranslations.language_id, defaultLangId));

      for (const dr of defaultRows) {
        if (!existingKeys.has(dr.key)) {
          rows.push({ key: dr.key, value: dr.value });
        }
      }
    }

    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  });
};
