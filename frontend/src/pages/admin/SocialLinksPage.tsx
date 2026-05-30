import { useState } from 'react';
import { SOCIAL_CATALOG } from '../../lib/social-catalog.js';
import { useAdminSocialLinks, useUpsertSocialLink } from '../../api/social-links.js';

export function SocialLinksPage() {
  const { data, isLoading } = useAdminSocialLinks();
  const upsert = useUpsertSocialLink();
  const [draft, setDraft] = useState<Record<string, { url: string; is_enabled: number; sort_order: number }>>({});

  if (isLoading) return <div className="page-loading"><span className="skeleton" style={{ height: '2rem', display: 'block' }} /></div>;

  const byPlatform = Object.fromEntries((data ?? []).map(r => [r.platform, r]));
  function val(p: string) {
    return draft[p] ?? { url: byPlatform[p]?.url ?? '', is_enabled: byPlatform[p]?.is_enabled ?? 0, sort_order: byPlatform[p]?.sort_order ?? 0 };
  }
  function set(p: string, patch: Partial<{ url: string; is_enabled: number; sort_order: number }>) {
    setDraft(d => ({ ...d, [p]: { ...val(p), ...patch } }));
  }

  return (
    <div className="admin-manager-page">
      <div className="admin-list-header"><h1>Social Links</h1></div>
      <ul className="social-admin-list">
        {SOCIAL_CATALOG.map(meta => {
          const v = val(meta.platform);
          return (
            <li key={meta.platform} className="social-admin-row card">
              <span className="social-admin-row__icon" aria-hidden="true">{meta.icon}</span>
              <span className="social-admin-row__label">{meta.label}</span>
              <label className="social-admin-row__toggle">
                <input type="checkbox" checked={v.is_enabled === 1}
                  onChange={e => set(meta.platform, { is_enabled: e.target.checked ? 1 : 0 })} />
                Enabled
              </label>
              <input className="social-admin-row__url" value={v.url}
                placeholder={meta.urlHint} onChange={e => set(meta.platform, { url: e.target.value })} />
              <input className="social-admin-row__order" type="number" value={v.sort_order}
                onChange={e => set(meta.platform, { sort_order: Number(e.target.value) })} />
              <button type="button" className="btn" disabled={upsert.isPending}
                onClick={() => upsert.mutate({ platform: meta.platform, ...v })}>Save</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
