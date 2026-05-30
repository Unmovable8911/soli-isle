import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TranslationTabs } from '../../admin/components/TranslationTabs.js';
import { useCategories } from '../../api/categories.js';
import { useLanguages } from '../../api/languages.js';
import { adminGet, adminCreate, adminUpdate } from '../../api/admin.js';

interface TransForm {
  title: string;
  description: string;
}

interface AdminResource {
  id: string;
  url: string;
  cover_image: string | null;
  category: { id: string; slug: string } | null;
  translations: { language_code: string; title: string; description: string | null }[];
}

export function ResourceEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === 'new';

  const { data: languages } = useLanguages();
  const { data: categories } = useCategories();
  const [activeLang, setActiveLang] = useState('');

  const [translations, setTranslations] = useState<Record<string, TransForm>>({});
  const [url, setUrl] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const { data: resource } = useQuery({
    queryKey: ['admin-resource', id],
    queryFn: () => adminGet<AdminResource>('resources', id!),
    enabled: !isNew,
  });

  // Reset form state when switching between new and edit
  useEffect(() => {
    if (isNew) {
      setUrl(''); setCoverImage(''); setCategoryId(''); setTranslations({}); setActiveLang('');
    }
  }, [isNew]);

  // Set default active lang from available languages
  useEffect(() => {
    if (languages && languages.length > 0 && !activeLang) {
      setActiveLang(languages[0]!.code);
    }
  }, [languages, activeLang]);

  // Populate form when editing existing resource
  useEffect(() => {
    if (resource) {
      setUrl(resource.url);
      setCoverImage(resource.cover_image ?? '');
      setCategoryId(resource.category?.id ?? '');
      const transMap: Record<string, TransForm> = {};
      for (const t of resource.translations ?? []) {
        transMap[t.language_code] = { title: t.title, description: t.description ?? '' };
      }
      setTranslations(transMap);
      const firstLang = resource.translations?.[0]?.language_code;
      if (firstLang) setActiveLang(firstLang);
    }
  }, [resource]);

  const saveMutation = useMutation({
    mutationFn: (data: unknown) =>
      isNew
        ? adminCreate('resources', data)
        : adminUpdate('resources', id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      navigate('/admin/resources');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate({
      url,
      cover_image: coverImage || null,
      category_id: categoryId || null,
      translations: Object.entries(translations).map(([code, data]) => ({
        language_code: code,
        title: data.title,
        description: data.description || null,
      })),
    });
  }

  const current = translations[activeLang] ?? { title: '', description: '' };

  function updateField(field: keyof TransForm, value: string) {
    setTranslations(prev => ({
      ...prev,
      [activeLang]: { ...(prev[activeLang] ?? { title: '', description: '' }), [field]: value },
    }));
  }

  return (
    <div className="admin-editor">
      <div className="admin-editor__head">
        <h1>{isNew ? 'New Resource' : 'Edit Resource'}</h1>
        <TranslationTabs activeLang={activeLang} onSelectLang={setActiveLang} />
      </div>
      <form onSubmit={handleSubmit} className="admin-editor__grid">
        <div className="admin-editor__main">
          <div className="form-row">
            <label htmlFor="title">Title</label>
            <input id="title" value={current.title} onChange={e => updateField('title', e.target.value)} />
          </div>
          <div className="form-row">
            <label htmlFor="description">Description</label>
            <textarea id="description" value={current.description} onChange={e => updateField('description', e.target.value)} />
          </div>
        </div>
        <aside className="admin-editor__aside">
          <div className="form-row">
            <label htmlFor="url">URL</label>
            <input id="url" type="url" value={url} onChange={e => setUrl(e.target.value)} required placeholder="https://..." />
          </div>
          <div className="form-row">
            <label htmlFor="cover-image">Cover Image URL</label>
            <input id="cover-image" value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="https://..." />
          </div>
          <div className="form-row">
            <label htmlFor="category">Category</label>
            <select id="category" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">None</option>
              {categories?.map(cat => (<option key={cat.id} value={cat.id}>{cat.translation.name ?? cat.slug}</option>))}
            </select>
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
