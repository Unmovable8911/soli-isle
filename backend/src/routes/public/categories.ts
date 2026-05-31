import { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { categories, categoryTranslations } from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/i18n.js';

export const publicCategoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/categories', async (request) => {
    const { lang } = request.query as { lang?: string };
    const { id: langId } = await resolveLanguage(app.db, lang);

    const rows = await app.db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categoryTranslations.name,
      })
      .from(categories)
      .innerJoin(
        categoryTranslations,
        and(
          eq(categories.id, categoryTranslations.category_id),
          eq(categoryTranslations.language_id, langId)
        )
      );

    return rows.map(r => ({
      id: r.id,
      slug: r.slug,
      translation: { name: r.name },
    }));
  });
};
