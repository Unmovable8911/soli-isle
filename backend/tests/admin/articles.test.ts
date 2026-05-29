import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, loginAsAdmin, seedLanguage } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let cookie: string;

beforeAll(async () => {
  app = await createTestApp();
  await seedLanguage(app.db);
  cookie = await loginAsAdmin(app);
});

afterAll(async () => { await app.close(); });

describe('POST /api/admin/articles', () => {
  it('creates an article and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/articles',
      headers: { cookie },
      payload: {
        slug: 'test-article',
        is_draft: 0,
        translations: [{ language_code: 'en', title: 'Test', body: '{}' }],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().slug).toBe('test-article');
  });

  it('rejects duplicate slug with 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/articles',
      headers: { cookie },
      payload: {
        slug: 'test-article',
        is_draft: 0,
        translations: [{ language_code: 'en', title: 'Dup', body: '{}' }],
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 401 without auth cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/articles',
      payload: { slug: 'no-auth', translations: [{ language_code: 'en', title: 'X', body: '{}' }] },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/admin/articles', () => {
  it('lists articles including drafts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/articles',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PUT /api/admin/articles/:id', () => {
  it('updates an article', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/admin/articles', headers: { cookie } });
    const id = listRes.json().data[0].id;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/articles/${id}`,
      headers: { cookie },
      payload: { is_draft: 1 },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('DELETE /api/admin/articles/:id', () => {
  it('deletes an article', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/admin/articles', headers: { cookie } });
    const id = listRes.json().data[0].id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/articles/${id}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
  });
});
