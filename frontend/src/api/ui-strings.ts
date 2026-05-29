import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

export function useUIStrings(lang: string) {
  return useQuery({
    queryKey: ['ui-strings', lang],
    queryFn: () => apiFetch<Record<string, string>>(`/ui-strings?lang=${lang}`),
    staleTime: Infinity,
    enabled: !!lang,
  });
}
