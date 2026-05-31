import { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, inArray, lt } from 'drizzle-orm';
import {
  articles, articleTranslations, articleTags,
  tags, tagTranslations, categories, categoryTranslations,
} from '../../db/schema/index.js';
import { resolveLanguage } from '../../lib/i18n.js';
import { decodeCursor, paginatedResult } from '../../lib/pagination.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export const publicArticleRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/articles — list published articles
  app.get('/api/articles', async (request) => {
    const db = app.db;
    const query = request.query as { lang?: string; cursor?: string; limit?: string; category?: string; tag?: string };
    const { id: langId } = await resolveLanguage(db, query.lang);
    const limit = Math.min(parseInt(query.limit || String(DEFAULT_LIMIT), 10), MAX_LIMIT);

    // Build tag filter
    let articleIds: string[] | undefined;
    if (query.tag) {
      const tagRows = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, query.tag));
      if (tagRows.length === 0) return { data: [], next_cursor: null };
      const tagArts = await db.select({ article_id: articleTags.article_id })
        .from(articleTags).where(eq(articleTags.tag_id, tagRows[0]!.id));
      articleIds = tagArts.map(r => r.article_id);
    }

    // Build conditions array
    const conditions = [
      eq(articles.is_draft, 0),
      eq(articleTranslations.language_id, langId),
    ] as ReturnType<typeof eq>[];

    if (query.category) {
      const catRows = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, query.category));
      if (catRows.length > 0) conditions.push(eq(articles.category_id, catRows[0]!.id));
      else return { data: [], next_cursor: null };
    }

    if (query.cursor) {
      conditions.push(lt(articles.published_at, decodeCursor(query.cursor)));
    }

    if (articleIds !== undefined) {
      if (articleIds.length === 0) return { data: [], next_cursor: null };
      conditions.push(inArray(articles.id, articleIds));
    }

    const rows = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        cover_image: articles.cover_image,
        published_at: articles.published_at,
        created_at: articles.created_at,
        updated_at: articles.updated_at,
        title: articleTranslations.title,
        excerpt: articleTranslations.excerpt,
      })
      .from(articles)
      .innerJoin(articleTranslations, eq(articles.id, articleTranslations.article_id))
      .where(and(...conditions))
      .orderBy(desc(articles.published_at))
      .limit(limit + 1);

    return paginatedResult(rows, 'published_at', limit);
  });

  // GET /api/articles/:slug — detail by slug
  app.get('/api/articles/:slug', async (request, reply) => {
    const db = app.db;
    const { slug } = request.params as { slug: string };
    const { lang } = request.query as { lang?: string };
    const { id: langId } = await resolveLanguage(db, lang);

    const rows = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        cover_image: articles.cover_image,
        published_at: articles.published_at,
        created_at: articles.created_at,
        updated_at: articles.updated_at,
        category_id: categories.id,
        category_slug: categories.slug,
        translation_title: articleTranslations.title,
        translation_body: articleTranslations.body,
        translation_excerpt: articleTranslations.excerpt,
      })
      .from(articles)
      .innerJoin(articleTranslations, and(eq(articles.id, articleTranslations.article_id), eq(articleTranslations.language_id, langId)))
      .leftJoin(categories, eq(articles.category_id, categories.id))
      .where(and(eq(articles.slug, slug), eq(articles.is_draft, 0)))
      .limit(1);

    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    const row = rows[0]!;

    // Fetch tags
    const tagRows = await db
      .select({ id: tags.id, slug: tags.slug, name: tagTranslations.name })
      .from(articleTags)
      .innerJoin(tags, eq(articleTags.tag_id, tags.id))
      .innerJoin(tagTranslations, and(eq(tags.id, tagTranslations.tag_id), eq(tagTranslations.language_id, langId)))
      .where(eq(articleTags.article_id, row.id));

    // Fetch category translation if category exists
    let categoryResult = null;
    if (row.category_id) {
      const catTrans = await db
        .select({ name: categoryTranslations.name })
        .from(categoryTranslations)
        .where(and(eq(categoryTranslations.category_id, row.category_id), eq(categoryTranslations.language_id, langId)))
        .limit(1);
      categoryResult = { id: row.category_id, slug: row.category_slug, translation: { name: catTrans[0]?.name ?? null } };
    }

    return {
      id: row.id,
      slug: row.slug,
      cover_image: row.cover_image,
      published_at: row.published_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      category: categoryResult,
      tags: tagRows.map(t => ({ id: t.id, slug: t.slug, translation: { name: t.name } })),
      translation: { title: row.translation_title, body: row.translation_body, excerpt: row.translation_excerpt },
    };
  });
};
