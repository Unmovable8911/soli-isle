import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, seedLanguage, now } from '../helpers.js';
import { categories, categoryTranslations } from '../../src/db/schema/index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
  const enId = await seedLanguage(app.db);
  const catId = crypto.randomUUID();
  await app.db.insert(categories).values({ id: catId, slug: 'tech', created_at: now, updated_at: now });
  await app.db.insert(categoryTranslations).values({ id: crypto.randomUUID(), category_id: catId, language_id: enId, name: 'Technology' });
});

afterAll(async () => { await app.close(); });

describe('GET /api/categories', () => {
  it('returns categories with translated names', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/categories?lang=en' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].slug).toBe('tech');
    expect(body[0].translation.name).toBe('Technology');
  });
});
