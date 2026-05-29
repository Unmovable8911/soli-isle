import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

export interface PageDetail {
  id: string;
  slug: string;
  published_at: string | null;
  sort_order: number;
  translation: { title: string; body: string };
}

export function usePages() {
  return useQuery({
    queryKey: ['pages'],
    queryFn: () => apiFetch<PageDetail[]>('/pages'),
  });
}

export function usePage(slug: string) {
  return useQuery({
    queryKey: ['page', slug],
    queryFn: () => apiFetch<PageDetail>(`/pages/${slug}`),
    enabled: !!slug,
  });
}
