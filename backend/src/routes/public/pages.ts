import { FastifyPluginAsync } from 'fastify';
import { eq, and, or, isNotNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { pages, pageTranslations } from '../../db/schema/index.js';
import { resolveLanguages } from '../../lib/i18n.js';

export const publicPageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/pages', async (request) => {
    const { lang } = request.query as { lang?: string };
    const { active, fallback } = await resolveLanguages(app.db, lang);

    const pa = alias(pageTranslations, 'pa');
    const pf = alias(pageTranslations, 'pf');

    const rows = await app.db
      .select({
        id: pages.id,
        slug: pages.slug,
        published_at: pages.published_at,
        sort_order: pages.sort_order,
        active_id: pa.id,
        active_title: pa.title,
        fb_title: pf.title,
      })
      .from(pages)
      .leftJoin(pa, and(eq(pages.id, pa.page_id), eq(pa.language_id, active.id)))
      .leftJoin(pf, and(eq(pages.id, pf.page_id), eq(pf.language_id, fallback.id)))
      .where(and(eq(pages.is_draft, 0), or(isNotNull(pa.id), isNotNull(pf.id))!))
      .orderBy(pages.sort_order);

    return rows.map(r => {
      const useActive = r.active_id != null;
      return {
        id: r.id,
        slug: r.slug,
        published_at: r.published_at,
        sort_order: r.sort_order,
        lang: useActive ? active.code : fallback.code,
        translation: { title: useActive ? r.active_title : r.fb_title },
      };
    });
  });

  app.get('/api/pages/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { lang } = request.query as { lang?: string };
    const { active, fallback } = await resolveLanguages(app.db, lang);

    const pa = alias(pageTranslations, 'pa');
    const pf = alias(pageTranslations, 'pf');

    const rows = await app.db
      .select({
        id: pages.id,
        slug: pages.slug,
        published_at: pages.published_at,
        sort_order: pages.sort_order,
        active_id: pa.id,
        active_title: pa.title,
        active_body: pa.body,
        fb_id: pf.id,
        fb_title: pf.title,
        fb_body: pf.body,
      })
      .from(pages)
      .leftJoin(pa, and(eq(pages.id, pa.page_id), eq(pa.language_id, active.id)))
      .leftJoin(pf, and(eq(pages.id, pf.page_id), eq(pf.language_id, fallback.id)))
      .where(and(eq(pages.slug, slug), eq(pages.is_draft, 0)))
      .limit(1);

    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    const row = rows[0]!;
    if (row.active_id == null && row.fb_id == null) return reply.status(404).send({ error: 'Not found' });
    const useActive = row.active_id != null;

    return {
      id: row.id,
      slug: row.slug,
      published_at: row.published_at,
      sort_order: row.sort_order,
      lang: useActive ? active.code : fallback.code,
      translation: {
        title: useActive ? row.active_title : row.fb_title,
        body: useActive ? row.active_body : row.fb_body,
      },
    };
  });
};
