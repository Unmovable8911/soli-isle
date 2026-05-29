import { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { tags, tagTranslations } from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/i18n.js';

export const publicTagRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/tags', async (request) => {
    const { lang } = request.query as { lang?: string };
    const { id: langId } = await resolveLanguage(app.db, lang);

    const rows = await app.db
      .select({
        id: tags.id,
        slug: tags.slug,
        name: tagTranslations.name,
      })
      .from(tags)
      .innerJoin(
        tagTranslations,
        and(eq(tags.id, tagTranslations.tag_id), eq(tagTranslations.language_id, langId))
      );

    return rows.map(r => ({
      id: r.id,
      slug: r.slug,
      translation: { name: r.name },
    }));
  });
};
