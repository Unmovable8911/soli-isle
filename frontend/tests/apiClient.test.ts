import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, setUnauthorizedHandler } from '../src/api/client.js';
import { login } from '../src/api/admin.js';

function mockFetch() {
  const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', f);
  return f;
}

function mockFetch401() {
  const f = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    json: async () => ({ error: 'Unauthorized' }),
  });
  vi.stubGlobal('fetch', f);
  return f;
}

describe('apiFetch lang param', () => {
  beforeEach(() => { localStorage.clear(); });

  it('appends stored lang for public paths', async () => {
    localStorage.setItem('soli-isle-lang', 'zh');
    const f = mockFetch();
    await apiFetch('/articles');
    expect(String(f.mock.calls[0][0])).toContain('lang=zh');
  });

  it('does NOT append stored lang for admin paths', async () => {
    localStorage.setItem('soli-isle-lang', 'zh');
    const f = mockFetch();
    await apiFetch('/admin/articles');
    expect(String(f.mock.calls[0][0])).not.toContain('lang=');
  });

  it('still honors an explicit lang option', async () => {
    const f = mockFetch();
    await apiFetch('/articles', { lang: 'en' });
    expect(String(f.mock.calls[0][0])).toContain('lang=en');
  });
});

describe('apiFetch unauthorized handling', () => {
  afterEach(() => { setUnauthorizedHandler(null); });

  it('invokes the unauthorized handler when an admin request returns 401', async () => {
    mockFetch401();
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    await expect(apiFetch('/admin/articles')).rejects.toThrow();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does NOT invoke the handler for a failed login (401 on /admin/login)', async () => {
    mockFetch401();
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    await expect(apiFetch('/admin/login', { method: 'POST', body: { password: 'x' } })).rejects.toThrow();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does NOT invoke the handler for a 401 on a public request', async () => {
    mockFetch401();
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    await expect(apiFetch('/articles')).rejects.toThrow();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('admin login body', () => {
  it('sends rememberMe: true when requested', async () => {
    const f = mockFetch();
    await login('secret', true);
    const body = JSON.parse((f.mock.calls[0][1] as { body: string }).body);
    expect(body).toEqual({ password: 'secret', rememberMe: true });
  });

  it('sends rememberMe: false by default', async () => {
    const f = mockFetch();
    await login('secret');
    const body = JSON.parse((f.mock.calls[0][1] as { body: string }).body);
    expect(body).toEqual({ password: 'secret', rememberMe: false });
  });
});
