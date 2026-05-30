import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from '../src/api/client.js';

function mockFetch() {
  const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
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
