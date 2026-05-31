import { apiFetch } from './client.js';

export async function login(password: string): Promise<void> {
  await apiFetch('/admin/login', { method: 'POST', body: { password } });
}

export async function logout(): Promise<void> {
  await apiFetch('/admin/logout', { method: 'POST' });
}

export async function checkAuth(): Promise<boolean> {
  const res = await apiFetch<{ authenticated: boolean }>('/admin/me');
  return res.authenticated;
}

export function adminList<T>(resource: string, params?: Record<string, string>) {
  return apiFetch<T>(`/admin/${resource}`, { params });
}

export function adminGet<T>(resource: string, id: string) {
  return apiFetch<T>(`/admin/${resource}/${id}`);
}

export function adminCreate<T>(resource: string, data: unknown) {
  return apiFetch<T>(`/admin/${resource}`, { method: 'POST', body: data });
}

export function adminUpdate<T>(resource: string, id: string, data: unknown) {
  return apiFetch<T>(`/admin/${resource}/${id}`, { method: 'PUT', body: data });
}

export function adminDelete(resource: string, id: string) {
  return apiFetch(`/admin/${resource}/${id}`, { method: 'DELETE' });
}
