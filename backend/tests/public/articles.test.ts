import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, seedLanguage, now } from '../helpers.js';
import { articles, articleTranslations, categories, categoryTranslations, tags, tagTranslations, articleTags, slugs } from '../../src/db/schema/index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
  const enId = await seedLanguage(app.db);
  const nowStr = new Date().toISOString();

  const catId = crypto.randomUUID();
  await app.db.insert(categories).values({ id: catId, slug: 'tech', created_at: now, updated_at: now });
  await app.db.insert(categoryTranslations).values({ id: crypto.randomUUID(), category_id: catId, language_id: enId, name: 'Technology' });

  const tagId = crypto.randomUUID();
  await app.db.insert(tags).values({ id: tagId, slug: 'rust', created_at: now, updated_at: now });
  await app.db.insert(tagTranslations).values({ id: crypto.randomUUID(), tag_id: tagId, language_id: enId, name: 'Rust' });

  const artId = crypto.randomUUID();
  await app.db.insert(slugs).values({ id: crypto.randomUUID(), slug: 'hello-world', entity_type: 'article', entity_id: artId });
  await app.db.insert(articles).values({ id: artId, slug: 'hello-world', category_id: catId, published_at: nowStr, is_draft: 0, created_at: now, updated_at: now });
  await app.db.insert(articleTranslations).values({ id: crypto.randomUUID(), article_id: artId, language_id: enId, title: 'Hello World', body: '{"type":"doc","content":[]}', excerpt: 'First post' });
  await app.db.insert(articleTags).values({ article_id: artId, tag_id: tagId });

  const draftId = crypto.randomUUID();
  await app.db.insert(slugs).values({ id: crypto.randomUUID(), slug: 'draft-post', entity_type: 'article', entity_id: draftId });
  await app.db.insert(articles).values({ id: draftId, slug: 'draft-post', published_at: nowStr, is_draft: 1, created_at: now, updated_at: now });
  await app.db.insert(articleTranslations).values({ id: crypto.randomUUID(), article_id: draftId, language_id: enId, title: 'Draft', body: '{}', excerpt: null });
});

afterAll(async () => { await app.close(); });

describe('GET /api/articles', () => {
  it('lists published articles only', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles?lang=en' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Hello World');
  });

  it('filters by category slug', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles?lang=en&category=tech' });
    expect(res.json().data).toHaveLength(1);
  });

  it('filters by category and returns empty for non-matching', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles?lang=en&category=nonexistent' });
    expect(res.json().data).toHaveLength(0);
  });

  it('filters by tag slug', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles?lang=en&tag=rust' });
    expect(res.json().data).toHaveLength(1);
  });
});

describe('GET /api/articles/:slug', () => {
  it('returns article detail with tags and category', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles/hello-world?lang=en' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.translation.title).toBe('Hello World');
    expect(body.tags).toHaveLength(1);
    expect(body.tags[0].slug).toBe('rust');
    expect(body.category.slug).toBe('tech');
  });

  it('returns 404 for non-existent slug', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles/nope?lang=en' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for draft article', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles/draft-post?lang=en' });
    expect(res.statusCode).toBe(404);
  });
});
