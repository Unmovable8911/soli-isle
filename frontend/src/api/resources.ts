import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';
import { useLanguage } from '../contexts/LanguageContext.js';

export interface ResourceListItem {
  id: string;
  url: string;
  cover_image: string | null;
  lang: string;
  category: { id: string; slug: string; translation: { name: string | null } } | null;
  translation: { title: string; description: string };
}

export function useResources(filters?: { category?: string }) {
  const { lang } = useLanguage();
  return useInfiniteQuery({
    queryKey: ['resources', lang, filters],
    queryFn: ({ pageParam }) =>
      apiFetch<{ data: ResourceListItem[]; next_cursor: string | null }>('/resources', {
        params: { ...filters, ...(pageParam ? { cursor: pageParam as string } : {}) },
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    initialPageParam: undefined as string | undefined,
  });
}
