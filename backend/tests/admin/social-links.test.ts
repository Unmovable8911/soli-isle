import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, loginAsAdmin } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance; let cookie: string;
beforeAll(async () => { app = await createTestApp(); cookie = await loginAsAdmin(app); });
afterAll(async () => { await app.close(); });

describe('admin social-links', () => {
  it('rejects unknown platform with 400', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/admin/social-links/myspace', headers: { cookie }, payload: { url: 'x', is_enabled: 1, sort_order: 0 } });
    expect(res.statusCode).toBe(400);
  });
  it('upserts a platform', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/admin/social-links/github', headers: { cookie }, payload: { url: 'https://github.com/me', is_enabled: 1, sort_order: 1 } });
    expect(res.statusCode).toBe(200);
    const list = await app.inject({ method: 'GET', url: '/api/admin/social-links', headers: { cookie } });
    expect(list.json().find((r: any) => r.platform === 'github').url).toBe('https://github.com/me');
  });
  it('updates the same platform without duplicating', async () => {
    await app.inject({ method: 'PUT', url: '/api/admin/social-links/github', headers: { cookie }, payload: { url: 'https://github.com/you', is_enabled: 0, sort_order: 2 } });
    const list = await app.inject({ method: 'GET', url: '/api/admin/social-links', headers: { cookie } });
    const rows = list.json().filter((r: any) => r.platform === 'github');
    expect(rows.length).toBe(1);
    expect(rows[0].is_enabled).toBe(0);
  });
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/social-links' });
    expect(res.statusCode).toBe(401);
  });
});
