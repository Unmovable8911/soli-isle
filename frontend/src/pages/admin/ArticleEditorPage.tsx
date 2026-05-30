import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TipTapEditor } from '../../admin/components/TipTapEditor.js';
import { TranslationTabs } from '../../admin/components/TranslationTabs.js';
import { useCategories } from '../../api/categories.js';
import { useTags } from '../../api/tags.js';
import { useLanguages } from '../../api/languages.js';
import { adminGet, adminCreate, adminUpdate } from '../../api/admin.js';
import type { ArticleDetail } from '../../api/articles.js';

interface TransForm {
  title: string;
  body: string;
  excerpt: string;
}

// The admin GET article endpoint returns more fields than the public one:
interface AdminArticle extends ArticleDetail {
  translations: { language_code: string; title: string; body: string; excerpt: string | null }[];
  tag_ids: string[];
  is_draft: number;
}

export function ArticleEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === 'new';

  const { data: languages } = useLanguages();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const [activeLang, setActiveLang] = useState('');

  const [translations, setTranslations] = useState<Record<string, TransForm>>({});
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isDraft, setIsDraft] = useState(true);
  const [coverImage, setCoverImage] = useState('');

  const { data: article } = useQuery({
    queryKey: ['admin-article', id],
    queryFn: () => adminGet<AdminArticle>('articles', id!),
    enabled: !isNew,
  });

  // Reset form state when switching between new and edit (e.g., navigating edit→new)
  useEffect(() => {
    if (isNew) {
      setSlug(''); setCategoryId(''); setSelectedTagIds([]);
      setIsDraft(true); setCoverImage(''); setTranslations({}); setActiveLang('');
    }
  }, [isNew]);

  // Set default active lang from available languages
  useEffect(() => {
    if (languages && languages.length > 0 && !activeLang) {
      setActiveLang(languages[0]!.code);
    }
  }, [languages, activeLang]);

  // Populate form when editing existing article
  useEffect(() => {
    if (article) {
      setSlug(article.slug);
      setCategoryId(article.category?.id ?? '');
      setSelectedTagIds(article.tag_ids ?? []);
      setIsDraft(article.is_draft === 1);
      setCoverImage(article.cover_image ?? '');
      const transMap: Record<string, TransForm> = {};
      for (const t of article.translations ?? []) {
        transMap[t.language_code] = { title: t.title, body: t.body, excerpt: t.excerpt ?? '' };
      }
      setTranslations(transMap);
      // Prefer the first translation's language so the form shows real content immediately
      const firstLang = article.translations?.[0]?.language_code;
      if (firstLang) setActiveLang(firstLang);
    }
  }, [article]);

  const saveMutation = useMutation({
    mutationFn: (data: unknown) =>
      isNew
        ? adminCreate('articles', data)
        : adminUpdate('articles', id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      navigate('/admin/articles');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate({
      slug,
      category_id: categoryId || null,
      cover_image: coverImage || null,
      is_draft: isDraft ? 1 : 0,
      tag_ids: selectedTagIds,
      translations: Object.entries(translations).map(([code, data]) => ({
        language_code: code,
        title: data.title,
        body: data.body,
        excerpt: data.excerpt || null,
      })),
    });
  }

  const current = translations[activeLang] ?? { title: '', body: '', excerpt: '' };

  function updateField(field: keyof TransForm, value: string) {
    setTranslations(prev => ({
      ...prev,
      [activeLang]: { ...(prev[activeLang] ?? { title: '', body: '', excerpt: '' }), [field]: value },
    }));
  }

  return (
    <div className="admin-editor">
      <div className="admin-editor__head">
        <h1>{isNew ? 'New Article' : 'Edit Article'}</h1>
        <TranslationTabs activeLang={activeLang} onSelectLang={setActiveLang} />
      </div>
      <form onSubmit={handleSubmit} className="admin-editor__grid">
        <div className="admin-editor__main">
          <div className="form-row">
            <label htmlFor="title">Title</label>
            <input id="title" value={current.title} onChange={e => updateField('title', e.target.value)} required />
          </div>
          <div className="form-row">
            <label htmlFor="excerpt">Excerpt</label>
            <textarea id="excerpt" value={current.excerpt} onChange={e => updateField('excerpt', e.target.value)} />
          </div>
          <div className="form-row">
            <label>Body</label>
            <TipTapEditor content={current.body} onChange={(json) => updateField('body', json)} />
          </div>
        </div>
        <aside className="admin-editor__aside">
          <div className="form-row">
            <label htmlFor="slug">Slug</label>
            <input id="slug" value={slug} onChange={e => setSlug(e.target.value)} required />
          </div>
          <div className="form-row">
            <label htmlFor="category">Category</label>
            <select id="category" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">None</option>
              {categories?.map(cat => (<option key={cat.id} value={cat.id}>{cat.translation.name ?? cat.slug}</option>))}
            </select>
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
          <div className="form-row">
            <label htmlFor="cover-image">Cover Image URL</label>
            <input id="cover-image" value={coverImage} onChange={e => setCoverImage(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="checkbox-label">
              <input type="checkbox" checked={isDraft} onChange={e => setIsDraft(e.target.checked)} />
              Draft
            </label>
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
