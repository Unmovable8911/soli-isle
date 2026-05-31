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

describe('POST /api/admin/pages', () => {
  it('creates a page', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/pages', headers: { cookie },
      payload: { slug: 'about', translations: [{ language_code: 'en', title: 'About', body: '{}' }] },
    });
    expect(res.statusCode).toBe(201);
  });

  it('rejects reserved slug', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/pages', headers: { cookie },
      payload: { slug: 'admin', translations: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects duplicate slug', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/pages', headers: { cookie },
      payload: { slug: 'about', translations: [] },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/pages', payload: { slug: 'x', translations: [] } });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/admin/pages', () => {
  it('lists pages', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/pages', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThanOrEqual(1);
  });
});

describe('DELETE /api/admin/pages/:id', () => {
  it('deletes a page', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/admin/pages', headers: { cookie } });
    const id = list.json()[0].id;
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/pages/${id}`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
  });
});
