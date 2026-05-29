import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

export interface ResourceListItem {
  id: string;
  url: string;
  cover_image: string | null;
  category: { id: string; slug: string; translation: { name: string | null } } | null;
  translation: { title: string; description: string };
}

export function useResources(filters?: { category?: string }) {
  return useInfiniteQuery({
    queryKey: ['resources', filters],
    queryFn: ({ pageParam }) =>
      apiFetch<{ data: ResourceListItem[]; next_cursor: string | null }>('/resources', {
        params: { ...filters, ...(pageParam ? { cursor: pageParam as string } : {}) },
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    initialPageParam: undefined as string | undefined,
  });
}
