import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

export interface Language {
  id: string;
  code: string;
  name: string;
  is_default: number;
}

export function useLanguages() {
  return useQuery({
    queryKey: ['languages'],
    queryFn: () => apiFetch<Language[]>('/languages'),
    staleTime: Infinity,
  });
}
