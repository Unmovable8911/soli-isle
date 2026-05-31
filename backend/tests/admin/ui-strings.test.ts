import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, loginAsAdmin, seedLanguage } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let cookie: string;
let langId: string;

beforeAll(async () => {
  app = await createTestApp();
  langId = await seedLanguage(app.db);
  cookie = await loginAsAdmin(app);
});
afterAll(async () => { await app.close(); });

describe('POST /api/admin/ui-strings', () => {
  it('creates a ui string', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/ui-strings', headers: { cookie },
      payload: { key: 'nav.home', language_id: langId, value: 'Home' },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe('GET /api/admin/ui-strings', () => {
  it('lists by language_id', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/admin/ui-strings?language_id=${langId}`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThanOrEqual(1);
  });

  it('lists all languages with language_code when no language_id given', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/ui-strings', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const rows = res.json() as Array<{ id: string; key: string; language_code: string; value: string }>;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const home = rows.find(r => r.key === 'nav.home');
    expect(home).toBeDefined();
    expect(home!.language_code).toBe('en');
    expect(home!.value).toBe('Home');
    expect(home!.id).toBeTruthy();
  });
});

describe('PUT /api/admin/ui-strings (batch)', () => {
  it('upserts strings', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/admin/ui-strings', headers: { cookie },
      payload: { language_id: langId, strings: [{ key: 'nav.home', value: 'Home Updated' }, { key: 'nav.about', value: 'About' }] },
    });
    expect(res.statusCode).toBe(200);
  });
});
