import { FastifyPluginAsync } from 'fastify';
import { eq, and, or, desc, inArray, lt, isNotNull, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import {
  articles, articleTranslations, articleTags,
  tags, tagTranslations, categories, categoryTranslations,
} from '../../db/schema/index.js';
import { resolveLanguages } from '../../lib/i18n.js';
import { decodeCursor, paginatedResult } from '../../lib/pagination.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export const publicArticleRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/articles — list published articles
  app.get('/api/articles', async (request) => {
    const db = app.db;
    const query = request.query as { lang?: string; cursor?: string; limit?: string; category?: string; tag?: string };
    const { active, fallback } = await resolveLanguages(db, query.lang);
    const limit = Math.min(parseInt(query.limit || String(DEFAULT_LIMIT), 10), MAX_LIMIT);

    // Active + default-language translation joins; an article appears as long as
    // EITHER exists (falling back to the default language per-item).
    const ta = alias(articleTranslations, 'ta');
    const tf = alias(articleTranslations, 'tf');

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
    const conditions: SQL[] = [
      eq(articles.is_draft, 0),
      or(isNotNull(ta.id), isNotNull(tf.id))!,
    ];

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
        active_id: ta.id,
        active_title: ta.title,
        active_excerpt: ta.excerpt,
        fb_title: tf.title,
        fb_excerpt: tf.excerpt,
      })
      .from(articles)
      .leftJoin(ta, and(eq(articles.id, ta.article_id), eq(ta.language_id, active.id)))
      .leftJoin(tf, and(eq(articles.id, tf.article_id), eq(tf.language_id, fallback.id)))
      .where(and(...conditions))
      .orderBy(desc(articles.published_at))
      .limit(limit + 1);

    const mapped = rows.map(r => {
      const useActive = r.active_id != null;
      return {
        id: r.id,
        slug: r.slug,
        cover_image: r.cover_image,
        published_at: r.published_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        lang: useActive ? active.code : fallback.code,
        title: useActive ? r.active_title : r.fb_title,
        excerpt: useActive ? r.active_excerpt : r.fb_excerpt,
      };
    });

    return paginatedResult(mapped, 'published_at', limit);
  });

  // GET /api/articles/:slug — detail by slug
  app.get('/api/articles/:slug', async (request, reply) => {
    const db = app.db;
    const { slug } = request.params as { slug: string };
    const { lang } = request.query as { lang?: string };
    const { active, fallback } = await resolveLanguages(db, lang);

    const ta = alias(articleTranslations, 'ta');
    const tf = alias(articleTranslations, 'tf');

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
        active_id: ta.id,
        active_title: ta.title,
        active_body: ta.body,
        active_excerpt: ta.excerpt,
        fb_id: tf.id,
        fb_title: tf.title,
        fb_body: tf.body,
        fb_excerpt: tf.excerpt,
      })
      .from(articles)
      .leftJoin(ta, and(eq(articles.id, ta.article_id), eq(ta.language_id, active.id)))
      .leftJoin(tf, and(eq(articles.id, tf.article_id), eq(tf.language_id, fallback.id)))
      .leftJoin(categories, eq(articles.category_id, categories.id))
      .where(and(eq(articles.slug, slug), eq(articles.is_draft, 0)))
      .limit(1);

    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    const row = rows[0]!;
    // No translation in either language → nothing to show.
    if (row.active_id == null && row.fb_id == null) return reply.status(404).send({ error: 'Not found' });
    const useActive = row.active_id != null;

    // Fetch tags (each falls back to the default language independently).
    const tta = alias(tagTranslations, 'tta');
    const ttf = alias(tagTranslations, 'ttf');
    const tagRows = await db
      .select({ id: tags.id, slug: tags.slug, active_name: tta.name, fb_name: ttf.name })
      .from(articleTags)
      .innerJoin(tags, eq(articleTags.tag_id, tags.id))
      .leftJoin(tta, and(eq(tags.id, tta.tag_id), eq(tta.language_id, active.id)))
      .leftJoin(ttf, and(eq(tags.id, ttf.tag_id), eq(ttf.language_id, fallback.id)))
      .where(eq(articleTags.article_id, row.id));

    // Fetch category translation if category exists (active, else default).
    let categoryResult = null;
    if (row.category_id) {
      const catTrans = await db
        .select({ name: categoryTranslations.name, language_id: categoryTranslations.language_id })
        .from(categoryTranslations)
        .where(and(
          eq(categoryTranslations.category_id, row.category_id),
          inArray(categoryTranslations.language_id, [active.id, fallback.id]),
        ));
      const activeName = catTrans.find(c => c.language_id === active.id)?.name;
      const fbName = catTrans.find(c => c.language_id === fallback.id)?.name;
      categoryResult = { id: row.category_id, slug: row.category_slug, translation: { name: activeName ?? fbName ?? null } };
    }

    return {
      id: row.id,
      slug: row.slug,
      cover_image: row.cover_image,
      published_at: row.published_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      lang: useActive ? active.code : fallback.code,
      category: categoryResult,
      tags: tagRows.map(t => ({ id: t.id, slug: t.slug, translation: { name: t.active_name ?? t.fb_name ?? null } })),
      translation: {
        title: useActive ? row.active_title : row.fb_title,
        body: useActive ? row.active_body : row.fb_body,
        excerpt: useActive ? row.active_excerpt : row.fb_excerpt,
      },
    };
  });
};
