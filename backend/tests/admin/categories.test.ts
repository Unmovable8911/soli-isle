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

describe('POST /api/admin/categories', () => {
  it('creates a category', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/categories', headers: { cookie },
      payload: { slug: 'tech', translations: [{ language_code: 'en', name: 'Technology' }] },
    });
    expect(res.statusCode).toBe(201);
  });

  it('returns 409 for duplicate slug', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/categories', headers: { cookie },
      payload: { slug: 'tech', translations: [] },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/categories', payload: { slug: 'x', translations: [] } });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/admin/categories', () => {
  it('lists categories', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/categories', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThanOrEqual(1);
  });
});

describe('DELETE /api/admin/categories/:id', () => {
  it('deletes a category', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/admin/categories', headers: { cookie } });
    const id = list.json()[0].id;
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/categories/${id}`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
  });
});
