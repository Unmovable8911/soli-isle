import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, loginAsAdmin } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); });

describe('POST /api/admin/login', () => {
  it('returns 400 when password is missing', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/login', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 for wrong password', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'wrong' } });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 and sets session cookie for correct password', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'test-password' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(res.headers['set-cookie']).toBeDefined();
  });
});

describe('GET /api/admin/me', () => {
  it('returns unauthenticated without cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/me' });
    expect(res.json()).toEqual({ authenticated: false });
  });

  it('returns authenticated with valid cookie', async () => {
    const cookie = await loginAsAdmin(app);
    const res = await app.inject({ method: 'GET', url: '/api/admin/me', headers: { cookie } });
    expect(res.json()).toEqual({ authenticated: true });
  });
});

describe('POST /api/admin/logout', () => {
  it('clears the session', async () => {
    const cookie = await loginAsAdmin(app);
    const logoutRes = await app.inject({ method: 'POST', url: '/api/admin/logout', headers: { cookie } });
    expect(logoutRes.json()).toEqual({ ok: true });

    const meRes = await app.inject({ method: 'GET', url: '/api/admin/me', headers: { cookie } });
    expect(meRes.json()).toEqual({ authenticated: false });
  });
});
