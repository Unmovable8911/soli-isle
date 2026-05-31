import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client.js';
import { adminList } from './admin.js';

export interface SocialLink { id: string; platform: string; url: string; is_enabled: number; sort_order: number; }

export function usePublicSocialLinks() {
  return useQuery({ queryKey: ['social-links'], queryFn: () => apiFetch<SocialLink[]>('/social-links') });
}
export function useAdminSocialLinks() {
  return useQuery({ queryKey: ['admin-social-links'], queryFn: () => adminList<SocialLink[]>('social-links') });
}
export function useUpsertSocialLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { platform: string; url: string; is_enabled: number; sort_order: number }) =>
      apiFetch(`/admin/social-links/${input.platform}`, { method: 'PUT', body: { url: input.url, is_enabled: input.is_enabled, sort_order: input.sort_order } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-social-links'] }); qc.invalidateQueries({ queryKey: ['social-links'] }); },
  });
}
