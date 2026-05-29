const BASE = '/api';

export async function apiFetch<T>(
  path: string,
  options?: {
    lang?: string;
    params?: Record<string, string>;
    method?: string;
    body?: unknown;
  }
): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  const lang = options?.lang ?? localStorage.getItem('soli-isle-lang');
  if (lang) url.searchParams.set('lang', lang);
  if (options?.params) {
    Object.entries(options.params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), {
    method: options?.method ?? 'GET',
    credentials: 'same-origin',
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error || 'Request failed');
  }

  return res.json();
}
