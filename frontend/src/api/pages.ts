import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';
import { useLanguage } from '../contexts/LanguageContext.js';

export interface PageDetail {
  id: string;
  slug: string;
  published_at: string | null;
  sort_order: number;
  lang: string;
  translation: { title: string; body: string };
}

export function usePages() {
  const { lang } = useLanguage();
  return useQuery({
    queryKey: ['pages', lang],
    queryFn: () => apiFetch<PageDetail[]>('/pages'),
  });
}

export function usePage(slug: string) {
  const { lang } = useLanguage();
  return useQuery({
    queryKey: ['page', lang, slug],
    queryFn: () => apiFetch<PageDetail>(`/pages/${slug}`),
    enabled: !!slug,
  });
}
