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

describe('GET /api/admin/media', () => {
  it('returns a list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/media', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/media' });
    expect(res.statusCode).toBe(401);
  });
});

describe('DELETE /api/admin/media/:filename', () => {
  it('returns 404 for non-existent file', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/admin/media/nonexistent.jpg', headers: { cookie } });
    expect(res.statusCode).toBe(404);
  });
});
