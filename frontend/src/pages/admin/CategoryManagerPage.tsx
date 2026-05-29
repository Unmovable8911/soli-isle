import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguages } from '../../api/languages.js';
import { adminList, adminCreate, adminDelete } from '../../api/admin.js';

interface AdminCategory {
  id: string;
  slug: string;
  translations: { language_code: string; name: string }[];
}

export function CategoryManagerPage() {
  const queryClient = useQueryClient();
  const { data: languages } = useLanguages();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => adminList<{ data: AdminCategory[] }>('categories'),
  });

  const [slug, setSlug] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreate('categories', {
        slug,
        translations: Object.entries(names)
          .filter(([, name]) => name.trim())
          .map(([language_code, name]) => ({ language_code, name })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setSlug('');
      setNames({});
      setCreateError('');
    },
    onError: (err) => {
      setCreateError((err as Error)?.message ?? 'Failed to create');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDelete('categories', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    createMutation.mutate();
  }

  if (isLoading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="admin-manager-page">
      <div className="admin-list-header">
        <h1>Categories</h1>
      </div>

      <div className="admin-manager-layout">
        <section className="admin-manager-list">
          <h2 className="admin-section-title">Existing</h2>
          {data?.data.length === 0 && (
            <p className="admin-empty">No categories yet.</p>
          )}
          <ul className="admin-item-list">
            {data?.data.map(cat => (
              <li key={cat.id} className="admin-item-row">
                <span className="admin-item-slug">{cat.slug}</span>
                <span className="admin-item-names">
                  {cat.translations.map(t => t.name).filter(Boolean).join(' / ') || '—'}
                </span>
                <button
                  type="button"
                  className="admin-delete-btn"
                  onClick={() => deleteMutation.mutate(cat.id)}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-manager-create">
          <h2 className="admin-section-title">Create New</h2>
          <form onSubmit={handleCreate} className="admin-form">
            <div className="form-row">
              <label htmlFor="cat-slug">Slug</label>
              <input
                id="cat-slug"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                required
                placeholder="e.g. technology"
              />
            </div>
            {languages?.map(lang => (
              <div key={lang.code} className="form-row">
                <label htmlFor={`cat-name-${lang.code}`}>Name ({lang.name})</label>
                <input
                  id={`cat-name-${lang.code}`}
                  value={names[lang.code] ?? ''}
                  onChange={e => setNames(prev => ({ ...prev, [lang.code]: e.target.value }))}
                  placeholder={`Name in ${lang.name}`}
                />
              </div>
            ))}
            <div className="form-actions">
              <button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
              {createError && <p className="error">{createError}</p>}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
