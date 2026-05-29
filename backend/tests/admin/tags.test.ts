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

describe('POST /api/admin/tags', () => {
  it('creates a tag', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/tags', headers: { cookie },
      payload: { slug: 'news', translations: [{ language_code: 'en', name: 'News' }] },
    });
    expect(res.statusCode).toBe(201);
  });

  it('returns 409 for duplicate slug', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/tags', headers: { cookie },
      payload: { slug: 'news', translations: [] },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/tags', payload: { slug: 'x', translations: [] } });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/admin/tags', () => {
  it('lists tags', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/tags', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThanOrEqual(1);
  });
});

describe('DELETE /api/admin/tags/:id', () => {
  it('deletes a tag', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/admin/tags', headers: { cookie } });
    const id = list.json()[0].id;
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/tags/${id}`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
  });
});
