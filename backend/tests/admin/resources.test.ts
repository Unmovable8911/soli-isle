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

describe('POST /api/admin/resources', () => {
  it('creates a resource', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/resources', headers: { cookie },
      payload: { url: 'https://example.com', translations: [{ language_code: 'en', title: 'Example', description: 'Desc' }] },
    });
    expect(res.statusCode).toBe(201);
  });
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/resources', payload: { url: 'x', translations: [] } });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/admin/resources', () => {
  it('lists resources', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/resources', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThanOrEqual(1);
  });
});

describe('DELETE /api/admin/resources/:id', () => {
  it('deletes a resource', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/admin/resources', headers: { cookie } });
    const id = list.json()[0].id;
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/resources/${id}`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
  });
});
