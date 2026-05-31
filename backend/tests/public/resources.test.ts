import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, seedLanguage, now } from '../helpers.js';
import { resources, resourceTranslations, categories, categoryTranslations } from '../../src/db/schema/index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
  const enId = await seedLanguage(app.db);

  const catId = crypto.randomUUID();
  await app.db.insert(categories).values({ id: catId, slug: 'tools', created_at: now, updated_at: now });
  await app.db.insert(categoryTranslations).values({ id: crypto.randomUUID(), category_id: catId, language_id: enId, name: 'Tools' });

  const resId = crypto.randomUUID();
  await app.db.insert(resources).values({ id: resId, url: 'https://example.com', category_id: catId, created_at: now, updated_at: now });
  await app.db.insert(resourceTranslations).values({ id: crypto.randomUUID(), resource_id: resId, language_id: enId, title: 'Example', description: 'An example resource' });
});

afterAll(async () => { await app.close(); });

describe('GET /api/resources', () => {
  it('lists resources with translation and category', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/resources?lang=en' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].translation.title).toBe('Example');
    expect(body.data[0].category.slug).toBe('tools');
  });

  it('filters by category', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/resources?lang=en&category=tools' });
    expect(res.json().data).toHaveLength(1);
  });

  it('returns empty for unknown category', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/resources?lang=en&category=nope' });
    expect(res.json().data).toHaveLength(0);
  });
});
