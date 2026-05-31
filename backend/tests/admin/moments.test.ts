import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, loginAsAdmin, seedLanguage, now } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let cookie: string;

beforeAll(async () => {
  app = await createTestApp();
  await seedLanguage(app.db);
  cookie = await loginAsAdmin(app);
});
afterAll(async () => { await app.close(); });

describe('POST /api/admin/moments', () => {
  it('creates a moment', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/moments', headers: { cookie },
      payload: { published_at: now, translations: [{ language_code: 'en', body: 'Hello' }] },
    });
    expect(res.statusCode).toBe(201);
  });
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/moments', payload: { published_at: now, translations: [] } });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/admin/moments', () => {
  it('lists moments', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/moments', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThanOrEqual(1);
  });
});

describe('DELETE /api/admin/moments/:id', () => {
  it('deletes a moment', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/admin/moments', headers: { cookie } });
    const id = list.json()[0].id;
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/moments/${id}`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
  });
});
