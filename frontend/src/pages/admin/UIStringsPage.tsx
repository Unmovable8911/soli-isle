import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguages } from '../../api/languages.js';
import { adminList, adminUpdate } from '../../api/admin.js';

interface UIStringItem {
  id: string;
  key: string;
  language_code: string;
  value: string;
}

// Group ui-strings by key, showing one row per key with one input per language
type StringsByKey = Record<string, Record<string, { id: string; value: string }>>;

export function UIStringsPage() {
  const queryClient = useQueryClient();
  const { data: languages } = useLanguages();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ui-strings'],
    queryFn: () => adminList<UIStringItem[]>('ui-strings'),
  });

  // Local edits: key -> lang_code -> value
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Populate local edits from fetched data
  useEffect(() => {
    if (data) {
      const initial: Record<string, Record<string, string>> = {};
      for (const item of data) {
        if (!initial[item.key]) initial[item.key] = {};
        initial[item.key]![item.language_code] = item.value;
      }
      setEdits(initial);
    }
  }, [data]);

  // Build grouped view for rendering
  const grouped: StringsByKey = {};
  if (data) {
    for (const item of data) {
      if (!grouped[item.key]) grouped[item.key] = {};
      grouped[item.key]![item.language_code] = { id: item.id, value: item.value };
    }
  }

  const allKeys = Object.keys(grouped).sort();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const updates: Promise<unknown>[] = [];
      for (const item of data) {
        const editedValue = edits[item.key]?.[item.language_code];
        if (editedValue !== undefined && editedValue !== item.value) {
          updates.push(adminUpdate('ui-strings', item.id, { value: editedValue }));
        }
      }
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ui-strings'] });
      setSaveError('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
    onError: (err) => {
      setSaveError((err as Error)?.message ?? 'Failed to save');
    },
  });

  function handleChange(key: string, langCode: string, value: string) {
    setEdits(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), [langCode]: value },
    }));
  }

  if (isLoading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="admin-list-page">
      <div className="admin-list-header">
        <h1>UI Strings</h1>
        <button
          type="button"
          className="admin-new-btn"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving...' : saveSuccess ? 'Saved' : 'Save All'}
        </button>
      </div>

      {saveError && <p className="error" style={{ marginBottom: '1rem' }}>{saveError}</p>}

      {allKeys.length === 0 ? (
        <p className="admin-empty">No UI strings found.</p>
      ) : (
        <div className="admin-ui-strings-table">
          <div className="admin-ui-strings-header">
            <span className="admin-ui-strings-key-col">Key</span>
            {languages?.map(lang => (
              <span key={lang.code} className="admin-ui-strings-lang-col">{lang.name}</span>
            ))}
          </div>
          {allKeys.map(key => (
            <div key={key} className="admin-ui-strings-row">
              <span className="admin-ui-strings-key-col admin-ui-key">{key}</span>
              {languages?.map(lang => {
                const currentValue = edits[key]?.[lang.code] ?? grouped[key]?.[lang.code]?.value ?? '';
                return (
                  <div key={lang.code} className="admin-ui-strings-lang-col">
                    <input
                      type="text"
                      value={currentValue}
                      onChange={e => handleChange(key, lang.code, e.target.value)}
                      className="admin-ui-input"
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
