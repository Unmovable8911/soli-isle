import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TipTapEditor } from '../../admin/components/TipTapEditor.js';
import { TranslationTabs } from '../../admin/components/TranslationTabs.js';
import { useTags } from '../../api/tags.js';
import { useLanguages } from '../../api/languages.js';
import { adminGet, adminCreate, adminUpdate } from '../../api/admin.js';

interface TransForm {
  body: string;
}

interface AdminMoment {
  id: string;
  published_at: string;
  translations: { language_code: string; body: string }[];
  tag_ids: string[];
}

export function MomentEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === 'new';

  const { data: languages } = useLanguages();
  const { data: tags } = useTags();
  const [activeLang, setActiveLang] = useState('');

  const [translations, setTranslations] = useState<Record<string, TransForm>>({});
  const [publishedAt, setPublishedAt] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const { data: moment } = useQuery({
    queryKey: ['admin-moment', id],
    queryFn: () => adminGet<AdminMoment>('moments', id!),
    enabled: !isNew,
  });

  // Reset form state when switching between new and edit
  useEffect(() => {
    if (isNew) {
      setPublishedAt(''); setSelectedTagIds([]); setTranslations({}); setActiveLang('');
    }
  }, [isNew]);

  // Set default active lang from available languages
  useEffect(() => {
    if (languages && languages.length > 0 && !activeLang) {
      setActiveLang(languages[0]!.code);
    }
  }, [languages, activeLang]);

  // Populate form when editing existing moment
  useEffect(() => {
    if (moment) {
      setPublishedAt(moment.published_at ? moment.published_at.slice(0, 10) : '');
      setSelectedTagIds(moment.tag_ids ?? []);
      const transMap: Record<string, TransForm> = {};
      for (const t of moment.translations ?? []) {
        transMap[t.language_code] = { body: t.body };
      }
      setTranslations(transMap);
      const firstLang = moment.translations?.[0]?.language_code;
      if (firstLang) setActiveLang(firstLang);
    }
  }, [moment]);

  const saveMutation = useMutation({
    mutationFn: (data: unknown) =>
      isNew
        ? adminCreate('moments', data)
        : adminUpdate('moments', id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-moments'] });
      queryClient.invalidateQueries({ queryKey: ['moments'] });
      navigate('/admin/moments');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate({
      published_at: publishedAt || new Date().toISOString().slice(0, 10),
      tag_ids: selectedTagIds,
      translations: Object.entries(translations).map(([code, data]) => ({
        language_code: code,
        body: data.body,
      })),
    });
  }

  const current = translations[activeLang] ?? { body: '' };

  function updateField(field: keyof TransForm, value: string) {
    setTranslations(prev => ({
      ...prev,
      [activeLang]: { ...(prev[activeLang] ?? { body: '' }), [field]: value },
    }));
  }

  return (
    <div className="admin-editor">
      <div className="admin-editor__head">
        <h1>{isNew ? 'New Moment' : 'Edit Moment'}</h1>
        <TranslationTabs activeLang={activeLang} onSelectLang={setActiveLang} />
      </div>
      <form onSubmit={handleSubmit} className="admin-editor__grid">
        <div className="admin-editor__main">
          <div className="form-row">
            <label>Body</label>
            <TipTapEditor content={current.body} onChange={(json) => updateField('body', json)} />
          </div>
        </div>
        <aside className="admin-editor__aside">
          <div className="form-row">
            <label htmlFor="published-at">Published At</label>
            <input id="published-at" type="date" value={publishedAt} onChange={e => setPublishedAt(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Tags</label>
            <div className="tag-checkboxes">
              {tags?.map(tag => (
                <label key={tag.id} className="tag-checkbox">
                  <input type="checkbox" checked={selectedTagIds.includes(tag.id)} onChange={() => setSelectedTagIds(prev => prev.includes(tag.id) ? prev.filter(tid => tid !== tag.id) : [...prev, tag.id])} />
                  {tag.translation.name ?? tag.slug}
                </label>
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : 'Save'}</button>
            {saveMutation.isError && <p className="error">{(saveMutation.error as Error)?.message ?? 'Failed to save'}</p>}
          </div>
        </aside>
      </form>
    </div>
  );
}
