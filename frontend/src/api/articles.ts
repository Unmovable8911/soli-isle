import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';
import { useLanguage } from '../contexts/LanguageContext.js';

export interface ArticleListItem {
  id: string;
  slug: string;
  cover_image: string | null;
  published_at: string;
  /** Language the item is shown in (may differ from the active language: fallback). */
  lang: string;
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
  lang: string;
  category: { id: string; slug: string; translation: { name: string | null } } | null;
  tags: { id: string; slug: string; translation: { name: string | null } }[];
  translation: { title: string; body: string; excerpt: string | null };
}

interface Paginated<T> { data: T[]; next_cursor: string | null }

export function useArticles(filters?: { category?: string; tag?: string }) {
  const { lang } = useLanguage();
  return useInfiniteQuery({
    queryKey: ['articles', lang, filters],
    queryFn: ({ pageParam }) =>
      apiFetch<Paginated<ArticleListItem>>('/articles', {
        params: { ...filters, ...(pageParam ? { cursor: pageParam as string } : {}) },
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    initialPageParam: undefined as string | undefined,
  });
}

export function useArticle(slug: string) {
  const { lang } = useLanguage();
  return useQuery({
    queryKey: ['article', lang, slug],
    queryFn: () => apiFetch<ArticleDetail>(`/articles/${slug}`),
    enabled: !!slug,
  });
}
