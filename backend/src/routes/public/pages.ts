import { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { pages, pageTranslations } from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/i18n.js';

export const publicPageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/pages', async (request) => {
    const { lang } = request.query as { lang?: string };
    const { id: langId } = await resolveLanguage(app.db, lang);

    const rows = await app.db
      .select({
        id: pages.id,
        slug: pages.slug,
        published_at: pages.published_at,
        sort_order: pages.sort_order,
        title: pageTranslations.title,
      })
      .from(pages)
      .innerJoin(pageTranslations, and(eq(pages.id, pageTranslations.page_id), eq(pageTranslations.language_id, langId)))
      .where(eq(pages.is_draft, 0))
      .orderBy(pages.sort_order);

    return rows.map(r => ({
      id: r.id,
      slug: r.slug,
      published_at: r.published_at,
      sort_order: r.sort_order,
      translation: { title: r.title },
    }));
  });

  app.get('/api/pages/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { lang } = request.query as { lang?: string };
    const { id: langId } = await resolveLanguage(app.db, lang);

    const rows = await app.db
      .select({
        id: pages.id,
        slug: pages.slug,
        published_at: pages.published_at,
        sort_order: pages.sort_order,
        title: pageTranslations.title,
        body: pageTranslations.body,
      })
      .from(pages)
      .innerJoin(pageTranslations, and(eq(pages.id, pageTranslations.page_id), eq(pageTranslations.language_id, langId)))
      .where(and(eq(pages.slug, slug), eq(pages.is_draft, 0)))
      .limit(1);

    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    const row = rows[0]!;
    return {
      id: row.id,
      slug: row.slug,
      published_at: row.published_at,
      sort_order: row.sort_order,
      translation: { title: row.title, body: row.body },
    };
  });
};
