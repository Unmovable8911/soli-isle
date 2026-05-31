import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

export interface MomentListItem {
  id: string;
  published_at: string;
  translation: { body: string };
  tags: { id: string; slug: string; translation: { name: string | null } }[];
}

export function useMoments(filters?: { tag?: string }) {
  return useInfiniteQuery({
    queryKey: ['moments', filters],
    queryFn: ({ pageParam }) =>
      apiFetch<{ data: MomentListItem[]; next_cursor: string | null }>('/moments', {
        params: { ...filters, ...(pageParam ? { cursor: pageParam as string } : {}) },
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    initialPageParam: undefined as string | undefined,
  });
}
