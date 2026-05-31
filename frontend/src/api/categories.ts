import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

export interface CategoryItem {
  id: string;
  slug: string;
  translation: { name: string | null };
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<CategoryItem[]>('/categories'),
    staleTime: Infinity,
  });
}
