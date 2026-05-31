import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';
import { useLanguage } from '../contexts/LanguageContext.js';

export interface MomentListItem {
  id: string;
  published_at: string;
  lang: string;
  translation: { body: string };
  tags: { id: string; slug: string; translation: { name: string | null } }[];
}

export function useMoments(filters?: { tag?: string }) {
  const { lang } = useLanguage();
  return useInfiniteQuery({
    queryKey: ['moments', lang, filters],
    queryFn: ({ pageParam }) =>
      apiFetch<{ data: MomentListItem[]; next_cursor: string | null }>('/moments', {
        params: { ...filters, ...(pageParam ? { cursor: pageParam as string } : {}) },
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    initialPageParam: undefined as string | undefined,
  });
}
