import { FastifyPluginAsync } from 'fastify';
import { eq, and, or, isNotNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { categories, categoryTranslations } from '../../db/schema/index.js';
import { resolveLanguages } from '../../lib/i18n.js';

export const publicCategoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/categories', async (request) => {
    const { lang } = request.query as { lang?: string };
    const { active, fallback } = await resolveLanguages(app.db, lang);

    const ca = alias(categoryTranslations, 'ca');
    const cf = alias(categoryTranslations, 'cf');

    const rows = await app.db
      .select({ id: categories.id, slug: categories.slug, active_name: ca.name, fb_name: cf.name })
      .from(categories)
      .leftJoin(ca, and(eq(categories.id, ca.category_id), eq(ca.language_id, active.id)))
      .leftJoin(cf, and(eq(categories.id, cf.category_id), eq(cf.language_id, fallback.id)))
      .where(or(isNotNull(ca.id), isNotNull(cf.id))!);

    return rows.map(r => ({
      id: r.id,
      slug: r.slug,
      translation: { name: r.active_name ?? r.fb_name ?? null },
    }));
  });
};
