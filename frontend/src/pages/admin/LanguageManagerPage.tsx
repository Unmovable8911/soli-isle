import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguages } from '../../api/languages.js';
import { adminCreate } from '../../api/admin.js';

export function LanguageManagerPage() {
  const queryClient = useQueryClient();
  const { data: languages, isLoading } = useLanguages();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [createError, setCreateError] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreate('languages', { code, name, is_default: isDefault ? 1 : 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['languages'] });
      setCode('');
      setName('');
      setIsDefault(false);
      setCreateError('');
    },
    onError: (err) => {
      setCreateError((err as Error)?.message ?? 'Failed to create');
    },
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    createMutation.mutate();
  }

  const currentDefault = languages?.find(l => l.is_default);

  if (isLoading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="admin-manager-page">
      <div className="admin-list-header">
        <h1>Languages</h1>
      </div>

      <div className="admin-manager-layout">
        <section className="admin-manager-list">
          <h2 className="admin-section-title">Existing</h2>
          {languages?.length === 0 && (
            <p className="admin-empty">No languages configured.</p>
          )}
          <ul className="admin-item-list">
            {languages?.map(lang => (
              <li key={lang.id} className="admin-item-row">
                <span className="admin-item-slug">{lang.code}</span>
                <span className="admin-item-names">{lang.name}</span>
                {lang.is_default ? (
                  <span className="admin-default-badge">Default</span>
                ) : (
                  <span className="admin-item-placeholder" />
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-manager-create">
          <h2 className="admin-section-title">Add Language</h2>
          <form onSubmit={handleCreate} className="admin-form">
            <div className="form-row">
              <label htmlFor="lang-code">Code</label>
              <input
                id="lang-code"
                value={code}
                onChange={e => setCode(e.target.value.toLowerCase())}
                required
                placeholder="e.g. en"
                maxLength={10}
              />
            </div>
            <div className="form-row">
              <label htmlFor="lang-name">Name</label>
              <input
                id="lang-name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="e.g. English"
              />
            </div>
            <div className="form-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                />
                Set as default language
              </label>
              {isDefault && currentDefault && (
                <p className="admin-warning">
                  This will replace the current default ({currentDefault.name}).
                </p>
              )}
            </div>
            <div className="form-actions">
              <button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding...' : 'Add Language'}
              </button>
              {createError && <p className="error">{createError}</p>}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
