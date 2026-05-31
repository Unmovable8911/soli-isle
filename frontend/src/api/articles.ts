import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

export interface ArticleListItem {
  id: string;
  slug: string;
  cover_image: string | null;
  published_at: string;
  title: string;
  excerpt: string | null;
}

export interface ArticleDetail {
  id: string;
  slug: string;
  cover_image: string | null;
  published_at: string;
  created_at: string;
  updated_at: string;
  category: { id: string; slug: string; translation: { name: string | null } } | null;
  tags: { id: string; slug: string; translation: { name: string | null } }[];
  translation: { title: string; body: string; excerpt: string | null };
}

interface Paginated<T> { data: T[]; next_cursor: string | null }

export function useArticles(filters?: { category?: string; tag?: string }) {
  return useInfiniteQuery({
    queryKey: ['articles', filters],
    queryFn: ({ pageParam }) =>
      apiFetch<Paginated<ArticleListItem>>('/articles', {
        params: { ...filters, ...(pageParam ? { cursor: pageParam as string } : {}) },
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    initialPageParam: undefined as string | undefined,
  });
}

export function useArticle(slug: string) {
  return useQuery({
    queryKey: ['article', slug],
    queryFn: () => apiFetch<ArticleDetail>(`/articles/${slug}`),
    enabled: !!slug,
  });
}
