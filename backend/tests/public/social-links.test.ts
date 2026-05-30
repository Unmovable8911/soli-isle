import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, loginAsAdmin } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
  const cookie = await loginAsAdmin(app);
  await app.inject({ method: 'PUT', url: '/api/admin/social-links/github', headers: { cookie }, payload: { url: 'https://github.com/me', is_enabled: 1, sort_order: 2 } });
  await app.inject({ method: 'PUT', url: '/api/admin/social-links/rss', headers: { cookie }, payload: { url: '/rss.xml', is_enabled: 0, sort_order: 1 } });
});
afterAll(async () => { await app.close(); });

describe('GET /api/social-links', () => {
  it('returns only enabled links ordered by sort_order', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/social-links' });
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.map((d: any) => d.platform)).toEqual(['github']);
  });
});
