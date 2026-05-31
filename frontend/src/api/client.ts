const BASE = '/api';

// Invoked when an authenticated admin request is rejected with 401 (i.e. the
// session expired or was destroyed server-side). AuthContext registers a handler
// that clears auth state so the app can redirect to login and notify the user.
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

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
  const isAdmin = path.startsWith('/admin/');
  const lang = options?.lang ?? (isAdmin ? null : localStorage.getItem('soli-isle-lang'));
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
    // A 401 on an authenticated admin request means the session expired. Notify
    // the app so it can log out and redirect — but not for /login (wrong password)
    // or public requests, where 401 is a normal, locally-handled response.
    if (res.status === 401 && isAdmin && path !== '/admin/login') {
      unauthorizedHandler?.();
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error || 'Request failed');
  }

  return res.json();
}
