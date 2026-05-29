import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

export interface TagItem {
  id: string;
  slug: string;
  translation: { name: string | null };
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => apiFetch<TagItem[]>('/tags'),
    staleTime: Infinity,
  });
}
