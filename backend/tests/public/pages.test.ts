import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, seedLanguage, now } from '../helpers.js';
import { pages, pageTranslations, slugs } from '../../src/db/schema/index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
  const enId = await seedLanguage(app.db);

  const pageId = crypto.randomUUID();
  await app.db.insert(slugs).values({ id: crypto.randomUUID(), slug: 'about', entity_type: 'page', entity_id: pageId });
  await app.db.insert(pages).values({ id: pageId, slug: 'about', published_at: now, is_draft: 0, sort_order: 1, created_at: now, updated_at: now });
  await app.db.insert(pageTranslations).values({ id: crypto.randomUUID(), page_id: pageId, language_id: enId, title: 'About', body: '{"type":"doc"}' });

  const draftId = crypto.randomUUID();
  await app.db.insert(slugs).values({ id: crypto.randomUUID(), slug: 'draft-page', entity_type: 'page', entity_id: draftId });
  await app.db.insert(pages).values({ id: draftId, slug: 'draft-page', is_draft: 1, sort_order: 2, created_at: now, updated_at: now });
  await app.db.insert(pageTranslations).values({ id: crypto.randomUUID(), page_id: draftId, language_id: enId, title: 'Draft Page', body: '{}' });
});

afterAll(async () => { await app.close(); });

describe('GET /api/pages', () => {
  it('lists only published pages', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/pages?lang=en' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].translation.title).toBe('About');
  });
});

describe('GET /api/pages/:slug', () => {
  it('returns page detail', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/pages/about?lang=en' });
    expect(res.statusCode).toBe(200);
    expect(res.json().translation.title).toBe('About');
  });

  it('returns 404 for draft', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/pages/draft-page?lang=en' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for unknown slug', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/pages/nope?lang=en' });
    expect(res.statusCode).toBe(404);
  });
});
