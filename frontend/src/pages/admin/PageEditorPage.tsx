import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TipTapEditor } from '../../admin/components/TipTapEditor.js';
import { TranslationTabs } from '../../admin/components/TranslationTabs.js';
import { useLanguages } from '../../api/languages.js';
import { adminGet, adminCreate, adminUpdate } from '../../api/admin.js';

interface TransForm {
  title: string;
  body: string;
}

interface AdminPage {
  id: string;
  slug: string;
  sort_order: number;
  is_draft: number;
  translations: { language_code: string; title: string; body: string }[];
}

const RESERVED_SLUGS = ['articles', 'moments', 'resources', 'api', 'admin', 'media'];

export function PageEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === 'new';

  const { data: languages } = useLanguages();
  const [activeLang, setActiveLang] = useState('');

  const [translations, setTranslations] = useState<Record<string, TransForm>>({});
  const [slug, setSlug] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [isDraft, setIsDraft] = useState(true);
  const [slugError, setSlugError] = useState('');

  const { data: page } = useQuery({
    queryKey: ['admin-page', id],
    queryFn: () => adminGet<AdminPage>('pages', id!),
    enabled: !isNew,
  });

  // Reset form state when switching between new and edit
  useEffect(() => {
    if (isNew) {
      setSlug(''); setSortOrder(0); setIsDraft(true); setTranslations({}); setActiveLang(''); setSlugError('');
    }
  }, [isNew]);

  // Set default active lang from available languages
  useEffect(() => {
    if (languages && languages.length > 0 && !activeLang) {
      setActiveLang(languages[0]!.code);
    }
  }, [languages, activeLang]);

  // Populate form when editing existing page
  useEffect(() => {
    if (page) {
      setSlug(page.slug);
      setSortOrder(page.sort_order ?? 0);
      setIsDraft(page.is_draft === 1);
      const transMap: Record<string, TransForm> = {};
      for (const t of page.translations ?? []) {
        transMap[t.language_code] = { title: t.title, body: t.body };
      }
      setTranslations(transMap);
      const firstLang = page.translations?.[0]?.language_code;
      if (firstLang) setActiveLang(firstLang);
    }
  }, [page]);

  const saveMutation = useMutation({
    mutationFn: (data: unknown) =>
      isNew
        ? adminCreate('pages', data)
        : adminUpdate('pages', id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      navigate('/admin/pages');
    },
  });

  function validateSlug(value: string): string {
    if (RESERVED_SLUGS.includes(value.toLowerCase())) {
      return `"${value}" is a reserved word and cannot be used as a page slug.`;
    }
    return '';
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    setSlugError(validateSlug(value));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validateSlug(slug);
    if (err) { setSlugError(err); return; }
    saveMutation.mutate({
      slug,
      is_draft: isDraft ? 1 : 0,
      sort_order: sortOrder,
      translations: Object.entries(translations).map(([code, data]) => ({
        language_code: code,
        title: data.title,
        body: data.body,
      })),
    });
  }

  const current = translations[activeLang] ?? { title: '', body: '' };

  function updateField(field: keyof TransForm, value: string) {
    setTranslations(prev => ({
      ...prev,
      [activeLang]: { ...(prev[activeLang] ?? { title: '', body: '' }), [field]: value },
    }));
  }

  return (
    <div className="admin-editor">
      <h1>{isNew ? 'New Page' : 'Edit Page'}</h1>
      <TranslationTabs activeLang={activeLang} onSelectLang={setActiveLang} />
      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-row">
          <label htmlFor="slug">Slug</label>
          <input
            id="slug"
            value={slug}
            onChange={e => handleSlugChange(e.target.value)}
            required
          />
          {slugError && <p className="error">{slugError}</p>}
        </div>
        <div className="form-row">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            value={current.title}
            onChange={e => updateField('title', e.target.value)}
          />
        </div>
        <div className="form-row">
          <label>Body</label>
          <TipTapEditor content={current.body} onChange={(json) => updateField('body', json)} />
        </div>
        <div className="form-row">
          <label htmlFor="sort-order">Sort Order</label>
          <input
            id="sort-order"
            type="number"
            value={sortOrder}
            onChange={e => setSortOrder(Number(e.target.value))}
          />
        </div>
        <div className="form-row">
          <label className="checkbox-label">
            <input type="checkbox" checked={isDraft} onChange={e => setIsDraft(e.target.checked)} />
            Draft
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={saveMutation.isPending || !!slugError}>
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          {saveMutation.isError && (
            <p className="error">{(saveMutation.error as Error)?.message ?? 'Failed to save'}</p>
          )}
        </div>
      </form>
    </div>
  );
}
