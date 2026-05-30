import { FastifyPluginAsync } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import { pages, pageTranslations, slugs, languages } from '../../db/schema/index.js';

const RESERVED_SLUGS = ['articles', 'moments', 'resources', 'api', 'admin', 'media'];

export const adminPageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/pages', async () => {
    const db = app.db;
    const defaultLang = await db.select({ id: languages.id }).from(languages)
      .where(eq(languages.is_default, 1)).limit(1);
    // Sentinel that cannot match a real UUID, so the join yields no translation
    // (rather than ALL translations → duplicate rows) when no default language exists.
    const defaultLangId = defaultLang[0]?.id ?? '__no_default__';
    return db
      .select({
        id: pages.id,
        slug: pages.slug,
        published_at: pages.published_at,
        is_draft: pages.is_draft,
        sort_order: pages.sort_order,
        created_at: pages.created_at,
        updated_at: pages.updated_at,
        translation_title: pageTranslations.title,
      })
      .from(pages)
      .leftJoin(
        pageTranslations,
        and(
          eq(pageTranslations.page_id, pages.id),
          eq(pageTranslations.language_id, defaultLangId),
        ),
      )
      .orderBy(pages.sort_order);
  });

  app.get('/api/admin/pages/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const rows = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });

    const trans = await db.select({ language_code: languages.code, title: pageTranslations.title, body: pageTranslations.body })
      .from(pageTranslations)
      .innerJoin(languages, eq(pageTranslations.language_id, languages.id))
      .where(eq(pageTranslations.page_id, id));

    return { ...rows[0]!, translations: trans };
  });

  app.post('/api/admin/pages', async (request, reply) => {
    const db = app.db;
    const body = request.body as { slug: string; is_draft?: number; sort_order?: number; published_at?: string; translations: { language_code: string; title: string; body: string }[] };

    if (RESERVED_SLUGS.includes(body.slug)) {
      return reply.status(400).send({ error: `Slug '${body.slug}' is reserved` });
    }

    const now = new Date().toISOString();
    const pageId = crypto.randomUUID();

    try {
      await db.insert(slugs).values({ id: crypto.randomUUID(), slug: body.slug, entity_type: 'page', entity_id: pageId });
    } catch {
      return reply.status(409).send({ error: 'Slug already exists' });
    }

    await db.insert(pages).values({ id: pageId, slug: body.slug, is_draft: body.is_draft ?? 1, sort_order: body.sort_order ?? 0, published_at: body.published_at ?? null, created_at: now, updated_at: now });

    for (const t of (body.translations ?? [])) {
      const langRows = await db.select().from(languages).where(eq(languages.code, t.language_code));
      if (langRows.length === 0) continue;
      await db.insert(pageTranslations).values({ id: crypto.randomUUID(), page_id: pageId, language_id: langRows[0]!.id, title: t.title, body: t.body });
    }

    return reply.status(201).send({ id: pageId, slug: body.slug });
  });

  app.put('/api/admin/pages/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const body = request.body as { slug?: string; is_draft?: number; sort_order?: number; published_at?: string; translations?: { language_code: string; title: string; body: string }[] };

    const existing = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });

    if (body.slug !== undefined && RESERVED_SLUGS.includes(body.slug)) {
      return reply.status(400).send({ error: `Slug '${body.slug}' is reserved` });
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.is_draft !== undefined) updateData.is_draft = body.is_draft;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
    if (body.published_at !== undefined) updateData.published_at = body.published_at;
    await db.update(pages).set(updateData).where(eq(pages.id, id));

    if (body.slug !== undefined) {
      // Update the slugs table to reflect the new slug
      try {
        await db.update(slugs).set({ slug: body.slug }).where(eq(slugs.entity_id, id));
      } catch {
        return reply.status(409).send({ error: 'Slug already exists' });
      }
    }

    if (body.translations) {
      await db.delete(pageTranslations).where(eq(pageTranslations.page_id, id));
      for (const t of body.translations) {
        const langRows = await db.select().from(languages).where(eq(languages.code, t.language_code));
        if (langRows.length === 0) continue;
        await db.insert(pageTranslations).values({ id: crypto.randomUUID(), page_id: id, language_id: langRows[0]!.id, title: t.title, body: t.body });
      }
    }

    return { ok: true };
  });

  app.delete('/api/admin/pages/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = app.db;
    const existing = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found' });
    // Delete child rows first to satisfy FK constraints (no ON DELETE CASCADE).
    await db.delete(pageTranslations).where(eq(pageTranslations.page_id, id));
    await db.delete(pages).where(eq(pages.id, id));
    await db.delete(slugs).where(eq(slugs.entity_id, id));
    return { ok: true };
  });
};
