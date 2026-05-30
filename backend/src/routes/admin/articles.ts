import { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, lt } from 'drizzle-orm';
import {
  articles, articleTranslations, articleTags,
  slugs, languages,
} from '../../db/schema/index.js';
import { decodeCursor, paginatedResult } from '../../lib/pagination.js';

export const adminArticleRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/admin/articles — list all (including drafts)
  app.get('/api/admin/articles', async (request) => {
    const query = request.query as { cursor?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit || '20', 10), 50);
    const db = app.db;

    const conditions: ReturnType<typeof eq>[] = [];
    if (query.cursor) {
      conditions.push(lt(articles.created_at, decodeCursor(query.cursor)));
    }

    // Resolve the default language so the list can show a human-readable title.
    const defaultLang = await db.select({ id: languages.id }).from(languages)
      .where(eq(languages.is_default, 1)).limit(1);
    const defaultLangId = defaultLang[0]?.id;

    const rows = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        is_draft: articles.is_draft,
        published_at: articles.published_at,
        created_at: articles.created_at,
        updated_at: articles.updated_at,
        translation_title: articleTranslations.title,
      })
      .from(articles)
      .leftJoin(
        articleTranslations,
        and(
          eq(articleTranslations.article_id, articles.id),
          defaultLangId ? eq(articleTranslations.language_id, defaultLangId) : undefined,
        ),
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(articles.created_at))
      .limit(limit + 1);

    return paginatedResult(rows, 'created_at', limit);
  });

  // GET /api/admin/articles/:id — single article with all translations
  app.get('/api/admin/articles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;

    const articleRows = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
    if (articleRows.length === 0) return reply.status(404).send({ error: 'Not found' });
    const article = articleRows[0]!;

    const transRows = await db
      .select({
        language_code: languages.code,
        title: articleTranslations.title,
        body: articleTranslations.body,
        excerpt: articleTranslations.excerpt,
      })
      .from(articleTranslations)
      .innerJoin(languages, eq(articleTranslations.language_id, languages.id))
      .where(eq(articleTranslations.article_id, id));

    const tagRows = await db
      .select({ tag_id: articleTags.tag_id })
      .from(articleTags)
      .where(eq(articleTags.article_id, id));

    return {
      ...article,
      translations: transRows,
      tag_ids: tagRows.map(t => t.tag_id),
    };
  });

  // POST /api/admin/articles — create
  app.post('/api/admin/articles', async (request, reply) => {
    const db = app.db;
    const body = request.body as {
      slug: string; category_id?: string; cover_image?: string;
      is_draft?: number; published_at?: string;
      translations: { language_code: string; title: string; body: string; excerpt?: string }[];
      tag_ids?: string[];
    };

    const now = new Date().toISOString();

    // Resolve language IDs before entering the synchronous transaction
    const translationData: { language_id: string; title: string; body: string; excerpt?: string }[] = [];
    for (const t of (body.translations ?? [])) {
      const langRows = await db.select().from(languages).where(eq(languages.code, t.language_code));
      if (langRows.length === 0) continue;
      translationData.push({ language_id: langRows[0]!.id, title: t.title, body: t.body, excerpt: t.excerpt });
    }

    let artId: string;
    try {
      artId = crypto.randomUUID();
      db.transaction((tx) => {
        tx.insert(slugs).values({ id: crypto.randomUUID(), slug: body.slug, entity_type: 'article', entity_id: artId }).run();
        tx.insert(articles).values({
          id: artId, slug: body.slug, category_id: body.category_id ?? null,
          cover_image: body.cover_image ?? null, published_at: body.published_at ?? null,
          is_draft: body.is_draft ?? 1, created_at: now, updated_at: now,
        }).run();
        for (const t of translationData) {
          tx.insert(articleTranslations).values({
            id: crypto.randomUUID(), article_id: artId, language_id: t.language_id,
            title: t.title, body: t.body, excerpt: t.excerpt ?? null,
          }).run();
        }
        if (body.tag_ids) {
          for (const tagId of body.tag_ids) {
            tx.insert(articleTags).values({ article_id: artId, tag_id: tagId }).run();
          }
        }
      });
    } catch (err: any) {
      if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err?.message && err.message.includes('UNIQUE constraint failed'))) {
        return reply.status(409).send({ error: 'Slug already exists' });
      }
      throw err;
    }
    return reply.status(201).send({ id: artId, slug: body.slug });
  });

  // PUT /api/admin/articles/:id — update
  app.put('/api/admin/articles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const body = request.body as {
      slug?: string; category_id?: string; cover_image?: string;
      is_draft?: number; published_at?: string;
      translations?: { language_code: string; title: string; body: string; excerpt?: string }[];
      tag_ids?: string[];
    };

    const existing = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.category_id !== undefined) updateData.category_id = body.category_id;
    if (body.cover_image !== undefined) updateData.cover_image = body.cover_image;
    if (body.is_draft !== undefined) updateData.is_draft = body.is_draft;
    if (body.published_at !== undefined) updateData.published_at = body.published_at;

    await db.update(articles).set(updateData).where(eq(articles.id, id));

    if (body.slug !== undefined) {
      // Update the slugs table to reflect the new slug
      try {
        await db.update(slugs).set({ slug: body.slug }).where(eq(slugs.entity_id, id));
      } catch {
        return reply.status(409).send({ error: 'Slug already exists' });
      }
    }

    if (body.translations) {
      await db.delete(articleTranslations).where(eq(articleTranslations.article_id, id));
      for (const t of body.translations) {
        const langRows = await db.select().from(languages).where(eq(languages.code, t.language_code));
        if (langRows.length === 0) continue;
        await db.insert(articleTranslations).values({
          id: crypto.randomUUID(), article_id: id, language_id: langRows[0]!.id,
          title: t.title, body: t.body, excerpt: t.excerpt ?? null,
        });
      }
    }

    if (body.tag_ids !== undefined) {
      await db.delete(articleTags).where(eq(articleTags.article_id, id));
      for (const tagId of body.tag_ids) {
        await db.insert(articleTags).values({ article_id: id, tag_id: tagId });
      }
    }

    return { ok: true };
  });

  // DELETE /api/admin/articles/:id
  app.delete('/api/admin/articles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const existing = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });

    // Delete child rows first: FK constraints (no ON DELETE CASCADE in the
    // migration) would otherwise reject deleting the parent article.
    await db.delete(articleTranslations).where(eq(articleTranslations.article_id, id));
    await db.delete(articleTags).where(eq(articleTags.article_id, id));
    await db.delete(articles).where(eq(articles.id, id));
    await db.delete(slugs).where(eq(slugs.entity_id, id));
    return { ok: true };
  });
};
