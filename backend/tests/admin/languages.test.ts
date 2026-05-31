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

describe('GET /api/admin/languages', () => {
  it('lists languages', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/languages', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThanOrEqual(2);
  });
});

describe('POST /api/admin/languages', () => {
  it('creates a language', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/languages', headers: { cookie },
      payload: { code: 'fr', name: 'Français' },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe('DELETE /api/admin/languages/:id', () => {
  it('cannot delete the default language', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/admin/languages', headers: { cookie } });
    const defaultLang = list.json().find((l: any) => l.is_default === 1);
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/languages/${defaultLang.id}`, headers: { cookie } });
    expect(res.statusCode).toBe(400);
  });

  it('can delete a non-default language', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/admin/languages', headers: { cookie } });
    const nonDefault = list.json().find((l: any) => l.is_default !== 1 && l.code === 'fr');
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/languages/${nonDefault.id}`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
  });
});
