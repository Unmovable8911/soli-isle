import { FastifyPluginAsync } from 'fastify';
import { eq, and, or, isNotNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { tags, tagTranslations } from '../../db/schema/index.js';
import { resolveLanguages } from '../../lib/i18n.js';

export const publicTagRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/tags', async (request) => {
    const { lang } = request.query as { lang?: string };
    const { active, fallback } = await resolveLanguages(app.db, lang);

    const ta = alias(tagTranslations, 'ta');
    const tf = alias(tagTranslations, 'tf');

    const rows = await app.db
      .select({ id: tags.id, slug: tags.slug, active_name: ta.name, fb_name: tf.name })
      .from(tags)
      .leftJoin(ta, and(eq(tags.id, ta.tag_id), eq(ta.language_id, active.id)))
      .leftJoin(tf, and(eq(tags.id, tf.tag_id), eq(tf.language_id, fallback.id)))
      .where(or(isNotNull(ta.id), isNotNull(tf.id))!);

    return rows.map(r => ({
      id: r.id,
      slug: r.slug,
      translation: { name: r.active_name ?? r.fb_name ?? null },
    }));
  });
};
