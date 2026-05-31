import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, seedLanguage, now } from '../helpers.js';
import { moments, momentTranslations, tags, tagTranslations, momentTags } from '../../src/db/schema/index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
  const enId = await seedLanguage(app.db);

  const tagId = crypto.randomUUID();
  await app.db.insert(tags).values({ id: tagId, slug: 'life', created_at: now, updated_at: now });
  await app.db.insert(tagTranslations).values({ id: crypto.randomUUID(), tag_id: tagId, language_id: enId, name: 'Life' });

  const momentId = crypto.randomUUID();
  await app.db.insert(moments).values({ id: momentId, published_at: now, created_at: now, updated_at: now });
  await app.db.insert(momentTranslations).values({ id: crypto.randomUUID(), moment_id: momentId, language_id: enId, body: 'Hello moment' });
  await app.db.insert(momentTags).values({ moment_id: momentId, tag_id: tagId });
});

afterAll(async () => { await app.close(); });

describe('GET /api/moments', () => {
  it('lists moments with translation', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/moments?lang=en' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].translation.body).toBe('Hello moment');
  });

  it('filters by tag', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/moments?lang=en&tag=life' });
    expect(res.json().data).toHaveLength(1);
  });

  it('returns empty for unknown tag', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/moments?lang=en&tag=nope' });
    expect(res.json().data).toHaveLength(0);
  });
});
