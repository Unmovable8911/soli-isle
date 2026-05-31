# Frontend Application — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the client-side SPA with Vite + React, covering all public-facing pages, admin interface, TipTap rich text editor, language switching, and infinite scroll.

**Architecture:** Vite builds the React SPA to static files. React Router v7 in SPA mode handles client-side routing. TanStack Query fetches JSON from the API and caches responses. TipTap renders rich text in read-only mode (public) and full editing mode (admin). Language state managed via React context with localStorage persistence and `navigator.language` auto-detection.

**Tech Stack:** Vite, React 19, React Router v7, TanStack Query v5, TipTap, Vitest, React Testing Library

**Depends on:** Plan 2 (Backend API)

---

## File Structure

```
frontend/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  .gitignore
  src/
    main.tsx
    App.tsx
    api/
      client.ts
      languages.ts
      ui-strings.ts
      articles.ts
      moments.ts
      resources.ts
      pages.ts
      categories.ts
      tags.ts
      admin.ts
    contexts/
      LanguageContext.tsx
      AuthContext.tsx
    components/
      Layout.tsx
      ArticleCard.tsx
      MomentCard.tsx
      ResourceCard.tsx
      RichContent.tsx
      FilterBar.tsx
      InfiniteScroll.tsx
      LanguageSwitcher.tsx
      ProtectedRoute.tsx
    pages/
      public/
        HomePage.tsx
        ArticlesPage.tsx
        ArticleDetailPage.tsx
        MomentsPage.tsx
        ResourcesPage.tsx
        PageDetailPage.tsx
      admin/
        LoginPage.tsx
        DashboardPage.tsx
        ArticleListPage.tsx
        ArticleEditorPage.tsx
        MomentEditorPage.tsx
        ResourceEditorPage.tsx
        PageEditorPage.tsx
        CategoryManagerPage.tsx
        TagManagerPage.tsx
        LanguageManagerPage.tsx
        UIStringsPage.tsx
        MediaPage.tsx
    admin/
      components/
        AdminLayout.tsx
        TipTapEditor.tsx
        TranslationTabs.tsx
  tests/
    setup.ts
    components/
      ArticleCard.test.tsx
      LanguageSwitcher.test.tsx
```

---

### Task 1: Scaffold Vite + React project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/.gitignore`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "soli-isle-frontend",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.60.0",
    "@tiptap/extension-image": "^2.10.0",
    "@tiptap/extension-link": "^2.10.0",
    "@tiptap/pm": "^2.10.0",
    "@tiptap/react": "^2.10.0",
    "@tiptap/starter-kit": "^2.10.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd frontend && npm install`
Expected: packages install, `node_modules` and `package-lock.json` created

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ES2022",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
```

- [ ] **Step 5: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Soli Isle</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create main.tsx**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 7: Create App.tsx (initial shell)**

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<div>Hello Soli Isle</div>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 8: Create .gitignore**

```
node_modules/
dist/
```

- [ ] **Step 9: Verify dev server starts**

Run: `cd frontend && npx vite & sleep 3 && curl -s http://localhost:5173 | head -20 && kill %1`
Expected: HTML response with `<div id="root">`

- [ ] **Step 10: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold Vite + React project with React Router and TanStack Query"
```

---

### Task 2: API client and all query hooks

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/languages.ts`
- Create: `frontend/src/api/ui-strings.ts`
- Create: `frontend/src/api/articles.ts`
- Create: `frontend/src/api/moments.ts`
- Create: `frontend/src/api/resources.ts`
- Create: `frontend/src/api/pages.ts`
- Create: `frontend/src/api/categories.ts`
- Create: `frontend/src/api/tags.ts`
- Create: `frontend/src/api/admin.ts`

- [ ] **Step 1: Create client.ts**

```typescript
const BASE = '/api';

export async function apiFetch<T>(
  path: string,
  options?: {
    lang?: string;
    params?: Record<string, string>;
    method?: string;
    body?: unknown;
  }
): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  const lang = options?.lang ?? localStorage.getItem('soli-isle-lang');
  if (lang) url.searchParams.set('lang', lang);
  if (options?.params) {
    Object.entries(options.params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), {
    method: options?.method ?? 'GET',
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error || 'Request failed');
  }

  return res.json();
}
```

- [ ] **Step 2: Create languages.ts**

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

export interface Language {
  id: string;
  code: string;
  name: string;
  is_default: number;
}

export function useLanguages() {
  return useQuery({
    queryKey: ['languages'],
    queryFn: () => apiFetch<Language[]>('/languages'),
    staleTime: Infinity,
  });
}
```

- [ ] **Step 3: Create ui-strings.ts**

```typescript
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
```

- [ ] **Step 4: Create articles.ts**

```typescript
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

export interface ArticleListItem {
  id: string;
  slug: string;
  cover_image: string | null;
  published_at: string;
  title: string;
  excerpt: string | null;
}

export interface ArticleDetail {
  id: string;
  slug: string;
  cover_image: string | null;
  published_at: string;
  created_at: string;
  updated_at: string;
  category: { id: string; slug: string; translation: { name: string | null } } | null;
  tags: { id: string; slug: string; translation: { name: string | null } }[];
  translation: { title: string; body: string; excerpt: string | null };
}

interface Paginated<T> { data: T[]; next_cursor: string | null }

export function useArticles(filters?: { category?: string; tag?: string }) {
  return useInfiniteQuery({
    queryKey: ['articles', filters],
    queryFn: ({ pageParam }) =>
      apiFetch<Paginated<ArticleListItem>>('/articles', {
        params: { ...filters, ...(pageParam ? { cursor: pageParam as string } : {}) },
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    initialPageParam: undefined as string | undefined,
  });
}

export function useArticle(slug: string) {
  return useQuery({
    queryKey: ['article', slug],
    queryFn: () => apiFetch<ArticleDetail>(`/articles/${slug}`),
    enabled: !!slug,
  });
}
```

- [ ] **Step 5: Create moments.ts**

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

interface MomentListItem {
  id: string;
  published_at: string;
  translation: { body: string };
  tags: { id: string; slug: string; translation: { name: string | null } }[];
}

export function useMoments(filters?: { tag?: string }) {
  return useInfiniteQuery({
    queryKey: ['moments', filters],
    queryFn: ({ pageParam }) =>
      apiFetch<{ data: MomentListItem[]; next_cursor: string | null }>('/moments', {
        params: { ...filters, ...(pageParam ? { cursor: pageParam as string } : {}) },
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    initialPageParam: undefined as string | undefined,
  });
}
```

- [ ] **Step 6: Create resources.ts**

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

interface ResourceListItem {
  id: string;
  url: string;
  cover_image: string | null;
  category: { id: string; slug: string; translation: { name: string | null } } | null;
  translation: { title: string; description: string };
}

export function useResources(filters?: { category?: string }) {
  return useInfiniteQuery({
    queryKey: ['resources', filters],
    queryFn: ({ pageParam }) =>
      apiFetch<{ data: ResourceListItem[]; next_cursor: string | null }>('/resources', {
        params: { ...filters, ...(pageParam ? { cursor: pageParam as string } : {}) },
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    initialPageParam: undefined as string | undefined,
  });
}
```

- [ ] **Step 7: Create pages.ts**

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

interface PageDetail {
  id: string;
  slug: string;
  published_at: string | null;
  sort_order: number;
  translation: { title: string; body: string };
}

export function usePages() {
  return useQuery({
    queryKey: ['pages'],
    queryFn: () => apiFetch<PageDetail[]>('/pages'),
  });
}

export function usePage(slug: string) {
  return useQuery({
    queryKey: ['page', slug],
    queryFn: () => apiFetch<PageDetail>(`/pages/${slug}`),
    enabled: !!slug,
  });
}
```

- [ ] **Step 8: Create categories.ts and tags.ts**

Create `frontend/src/api/categories.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

interface CategoryItem {
  id: string;
  slug: string;
  translation: { name: string | null };
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<CategoryItem[]>('/categories'),
    staleTime: Infinity,
  });
}
```

Create `frontend/src/api/tags.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';

interface TagItem {
  id: string;
  slug: string;
  translation: { name: string | null };
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => apiFetch<TagItem[]>('/tags'),
    staleTime: Infinity,
  });
}
```

- [ ] **Step 9: Create admin.ts**

```typescript
import { apiFetch } from './client.js';

export async function login(password: string): Promise<void> {
  await apiFetch('/admin/login', { method: 'POST', body: { password } });
}

export async function logout(): Promise<void> {
  await apiFetch('/admin/logout', { method: 'POST' });
}

export async function checkAuth(): Promise<boolean> {
  const res = await apiFetch<{ authenticated: boolean }>('/admin/me');
  return res.authenticated;
}

export function adminList<T>(resource: string, params?: Record<string, string>) {
  return apiFetch<T>(`/admin/${resource}`, { params });
}

export function adminGet<T>(resource: string, id: string) {
  return apiFetch<T>(`/admin/${resource}/${id}`);
}

export function adminCreate<T>(resource: string, data: unknown) {
  return apiFetch<T>(`/admin/${resource}`, { method: 'POST', body: data });
}

export function adminUpdate<T>(resource: string, id: string, data: unknown) {
  return apiFetch<T>(`/admin/${resource}/${id}`, { method: 'PUT', body: data });
}

export function adminDelete(resource: string, id: string) {
  return apiFetch(`/admin/${resource}/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 10: Commit**

```bash
git add frontend/src/api/
git commit -m "feat: add API client and query hooks for all content types"
```

---

### Task 3: Language context and switcher

**Files:**
- Create: `frontend/src/contexts/LanguageContext.tsx`
- Create: `frontend/src/components/LanguageSwitcher.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/tests/setup.ts`

- [ ] **Step 1: Create LanguageContext.tsx**

```typescript
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useLanguages } from '../api/languages.js';

interface LanguageContextValue {
  lang: string;
  setLang: (code: string) => void;
  availableLanguages: { code: string; name: string }[];
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = 'soli-isle-lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { data: languages } = useLanguages();
  const [lang, setLangState] = useState<string>('');

  useEffect(() => {
    if (!languages || languages.length === 0) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && languages.some(l => l.code === stored)) {
      setLangState(stored);
      return;
    }

    const browserLang = navigator.language.slice(0, 2);
    if (languages.some(l => l.code === browserLang)) {
      setLangState(browserLang);
      return;
    }

    const defaultLang = languages.find(l => l.is_default === 1);
    setLangState(defaultLang?.code ?? languages[0]!.code);
  }, [languages]);

  const setLang = useCallback((code: string) => {
    localStorage.setItem(STORAGE_KEY, code);
    setLangState(code);
  }, []);

  const availableLanguages = (languages ?? []).map(l => ({ code: l.code, name: l.name }));

  return (
    <LanguageContext.Provider value={{ lang, setLang, availableLanguages }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
```

- [ ] **Step 2: Create LanguageSwitcher.tsx**

```typescript
import { useLanguage } from '../contexts/LanguageContext.js';

export function LanguageSwitcher() {
  const { lang, setLang, availableLanguages } = useLanguage();
  if (availableLanguages.length <= 1) return null;

  return (
    <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Select language">
      {availableLanguages.map((l) => (
        <option key={l.code} value={l.code}>{l.name}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 3: Wire into App.tsx**

```typescript
import { LanguageProvider } from './contexts/LanguageContext.js';

// Update App component:
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<div>Hello Soli Isle</div>} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Create test setup**

Create `frontend/tests/setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/contexts/LanguageContext.tsx frontend/src/components/LanguageSwitcher.tsx frontend/src/App.tsx frontend/tests/setup.ts
git commit -m "feat: add language context with auto-detection and switcher component"
```

---

### Task 4: Core components — Layout, RichContent, Cards, FilterBar, InfiniteScroll

**Files:**
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/RichContent.tsx`
- Create: `frontend/src/components/ArticleCard.tsx`
- Create: `frontend/src/components/MomentCard.tsx`
- Create: `frontend/src/components/ResourceCard.tsx`
- Create: `frontend/src/components/FilterBar.tsx`
- Create: `frontend/src/components/InfiniteScroll.tsx`

- [ ] **Step 1: Create Layout.tsx**

```typescript
import { Outlet, Link } from 'react-router';
import { LanguageSwitcher } from './LanguageSwitcher.js';

export function Layout() {
  return (
    <div className="layout">
      <header>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/articles">Articles</Link>
          <Link to="/moments">Moments</Link>
          <Link to="/resources">Resources</Link>
        </nav>
        <LanguageSwitcher />
      </header>
      <main><Outlet /></main>
      <footer><p>Soli Isle</p></footer>
    </div>
  );
}
```

- [ ] **Step 2: Create RichContent.tsx**

```typescript
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useEffect } from 'react';

const extensions = [StarterKit, Link.configure({ openOnClick: true }), Image];

export function RichContent({ content }: { content: string }) {
  const editor = useEditor({ extensions, editable: false, content: JSON.parse(content) });

  useEffect(() => {
    if (editor && content) {
      const parsed = JSON.parse(content);
      editor.commands.setContent(parsed);
    }
  }, [editor, content]);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
```

- [ ] **Step 3: Create ArticleCard.tsx**

```typescript
import { Link } from 'react-router';
import type { ArticleListItem } from '../api/articles.js';

export function ArticleCard({ article }: { article: ArticleListItem }) {
  return (
    <article className="article-card">
      {article.cover_image && <img src={article.cover_image} alt="" />}
      <h2><Link to={`/articles/${article.slug}`}>{article.title}</Link></h2>
      {article.excerpt && <p>{article.excerpt}</p>}
      <time dateTime={article.published_at}>
        {new Date(article.published_at).toLocaleDateString()}
      </time>
    </article>
  );
}
```

- [ ] **Step 4: Create MomentCard.tsx**

```typescript
import { RichContent } from './RichContent.js';

interface MomentCardProps {
  moment: {
    id: string;
    published_at: string;
    translation: { body: string };
    tags: { id: string; slug: string; translation: { name: string | null } }[];
  };
}

export function MomentCard({ moment }: MomentCardProps) {
  return (
    <div className="moment-card">
      <RichContent content={moment.translation.body} />
      {moment.tags.length > 0 && (
        <div className="moment-card__tags">
          {moment.tags.map(tag => (
            <span key={tag.id} className="tag-pill">{tag.translation.name ?? tag.slug}</span>
          ))}
        </div>
      )}
      <time dateTime={moment.published_at}>
        {new Date(moment.published_at).toLocaleDateString()}
      </time>
    </div>
  );
}
```

- [ ] **Step 5: Create ResourceCard.tsx**

```typescript
interface ResourceCardProps {
  resource: {
    id: string;
    url: string;
    cover_image: string | null;
    translation: { title: string; description: string };
    category: { id: string; slug: string; translation: { name: string | null } } | null;
  };
}

export function ResourceCard({ resource }: ResourceCardProps) {
  return (
    <a href={resource.url} className="resource-card" target="_blank" rel="noopener noreferrer">
      {resource.cover_image && <img src={resource.cover_image} alt="" />}
      <h3>{resource.translation.title}</h3>
      <p>{resource.translation.description}</p>
      {resource.category && (
        <span className="category-label">{resource.category.translation.name ?? resource.category.slug}</span>
      )}
    </a>
  );
}
```

- [ ] **Step 6: Create FilterBar.tsx**

```typescript
import { useSearchParams } from 'react-router';
import { useCategories } from '../api/categories.js';
import { useTags } from '../api/tags.js';

export function FilterBar({ show }: { show: 'categories' | 'tags' | 'both' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();

  const activeCategory = searchParams.get('category');
  const activeTag = searchParams.get('tag');

  function toggleParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (next.get(key) === value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  }

  return (
    <div className="filter-bar">
      {(show === 'categories' || show === 'both') && categories && (
        <div className="filter-group">
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`filter-pill ${activeCategory === cat.slug ? 'active' : ''}`}
              onClick={() => toggleParam('category', cat.slug)}
            >
              {cat.translation.name ?? cat.slug}
            </button>
          ))}
        </div>
      )}
      {(show === 'tags' || show === 'both') && tags && (
        <div className="filter-group">
          {tags.map(tag => (
            <button
              key={tag.id}
              className={`filter-pill ${activeTag === tag.slug ? 'active' : ''}`}
              onClick={() => toggleParam('tag', tag.slug)}
            >
              {tag.translation.name ?? tag.slug}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Create InfiniteScroll.tsx**

```typescript
import { useEffect, useRef, type ReactNode } from 'react';

interface InfiniteScrollProps {
  children: ReactNode;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export function InfiniteScroll({ children, hasNextPage, isFetchingNextPage, fetchNextPage }: InfiniteScrollProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]!.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div>
      {children}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {isFetchingNextPage && <div>Loading more...</div>}
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: add Layout, cards, RichContent, FilterBar, and InfiniteScroll components"
```

---

### Task 5: Public pages

**Files:**
- Create: `frontend/src/pages/public/HomePage.tsx`
- Create: `frontend/src/pages/public/ArticlesPage.tsx`
- Create: `frontend/src/pages/public/ArticleDetailPage.tsx`
- Create: `frontend/src/pages/public/MomentsPage.tsx`
- Create: `frontend/src/pages/public/ResourcesPage.tsx`
- Create: `frontend/src/pages/public/PageDetailPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create HomePage.tsx**

```typescript
import { useArticles } from '../../api/articles.js';
import { useMoments } from '../../api/moments.js';
import { ArticleCard } from '../../components/ArticleCard.js';
import { MomentCard } from '../../components/MomentCard.js';

export function HomePage() {
  const articles = useArticles();
  const moments = useMoments();

  const recentArticles = articles.data?.pages.flatMap(p => p.data) ?? [];
  const recentMoments = moments.data?.pages.flatMap(p => p.data) ?? [];

  const items = [
    ...recentArticles.map(a => ({ type: 'article' as const, data: a, date: a.published_at })),
    ...recentMoments.map(m => ({ type: 'moment' as const, data: m, date: m.published_at })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);

  return (
    <div className="home-feed">
      {items.map(item =>
        item.type === 'article'
          ? <ArticleCard key={item.data.id} article={item.data} />
          : <MomentCard key={item.data.id} moment={item.data} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ArticlesPage.tsx**

```typescript
import { useSearchParams } from 'react-router';
import { useArticles } from '../../api/articles.js';
import { ArticleCard } from '../../components/ArticleCard.js';
import { FilterBar } from '../../components/FilterBar.js';
import { InfiniteScroll } from '../../components/InfiniteScroll.js';

export function ArticlesPage() {
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') ?? undefined;
  const tag = searchParams.get('tag') ?? undefined;

  const query = useArticles({ category, tag });
  const articles = query.data?.pages.flatMap(p => p.data) ?? [];

  return (
    <div>
      <h1>Articles</h1>
      <FilterBar show="both" />
      <InfiniteScroll hasNextPage={!!query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage}>
        {articles.map(article => <ArticleCard key={article.id} article={article} />)}
      </InfiniteScroll>
    </div>
  );
}
```

- [ ] **Step 3: Create ArticleDetailPage.tsx**

```typescript
import { useParams, Link } from 'react-router';
import { useArticle } from '../../api/articles.js';
import { RichContent } from '../../components/RichContent.js';

export function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: article, isLoading, error } = useArticle(slug!);

  if (isLoading) return <div>Loading...</div>;
  if (error || !article) return <div>Article not found</div>;

  return (
    <article>
      <Link to="/articles">Back to articles</Link>
      <h1>{article.translation.title}</h1>
      {article.cover_image && <img src={article.cover_image} alt="" />}
      <time dateTime={article.published_at}>{new Date(article.published_at).toLocaleDateString()}</time>
      {article.category && <span>{article.category.translation.name ?? article.category.slug}</span>}
      <RichContent content={article.translation.body} />
      {article.tags.length > 0 && (
        <div>
          {article.tags.map(tag => (
            <Link key={tag.id} to={`/articles?tag=${tag.slug}`} className="tag-pill">
              {tag.translation.name ?? tag.slug}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 4: Create MomentsPage.tsx, ResourcesPage.tsx, PageDetailPage.tsx**

Following the same pattern as Task 5 Steps 2-3.

- **MomentsPage.tsx** — `useInfiniteQuery` from `useMoments`, render with `MomentCard` + `InfiniteScroll` + `FilterBar show="tags"`
- **ResourcesPage.tsx** — `useInfiniteQuery` from `useResources`, render with `ResourceCard` + `InfiniteScroll` + `FilterBar show="categories"`
- **PageDetailPage.tsx** — `useQuery` from `usePage(slug)`, render title + `RichContent`

- [ ] **Step 5: Wire routes in App.tsx**

```typescript
import { Layout } from './components/Layout.js';
import { HomePage } from './pages/public/HomePage.js';
import { ArticlesPage } from './pages/public/ArticlesPage.js';
import { ArticleDetailPage } from './pages/public/ArticleDetailPage.js';
import { MomentsPage } from './pages/public/MomentsPage.js';
import { ResourcesPage } from './pages/public/ResourcesPage.js';
import { PageDetailPage } from './pages/public/PageDetailPage.js';

// Routes:
<Routes>
  <Route element={<Layout />}>
    <Route index element={<HomePage />} />
    <Route path="articles" element={<ArticlesPage />} />
    <Route path="articles/:slug" element={<ArticleDetailPage />} />
    <Route path="moments" element={<MomentsPage />} />
    <Route path="resources" element={<ResourcesPage />} />
    <Route path=":slug" element={<PageDetailPage />} />
  </Route>
</Routes>
```

The `:slug` catch-all for pages must be last so it doesn't swallow the named routes. React Router v7 matches in order, so this works correctly.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/public/ frontend/src/App.tsx
git commit -m "feat: add all public pages with routing"
```

---

### Task 6: Admin auth, ProtectedRoute, and login page

**Files:**
- Create: `frontend/src/contexts/AuthContext.tsx`
- Create: `frontend/src/components/ProtectedRoute.tsx`
- Create: `frontend/src/pages/admin/LoginPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create AuthContext.tsx**

```typescript
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { checkAuth, login as apiLogin, logout as apiLogout } from '../api/admin.js';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  check: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const check = useCallback(async () => {
    try {
      const ok = await checkAuth();
      setIsAuthenticated(ok);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (password: string) => {
    await apiLogin(password);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, check }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Create ProtectedRoute.tsx**

```typescript
import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../contexts/AuthContext.js';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, check } = useAuth();

  useEffect(() => { check(); }, [check]);

  if (isLoading) return <div>Checking authentication...</div>;
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;

  return <Outlet />;
}
```

- [ ] **Step 3: Create LoginPage.tsx**

```typescript
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext.js';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (isAuthenticated) {
    navigate('/admin', { replace: true });
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(password);
      navigate('/admin', { replace: true });
    } catch {
      setError('Invalid password');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Admin Login</h1>
      {error && <p className="error">{error}</p>}
      <input type="password" value={password} onChange={e => setPassword(e.target.value)}
        placeholder="Password" autoFocus />
      <button type="submit">Log in</button>
    </form>
  );
}
```

- [ ] **Step 4: Wire admin into App.tsx**

```typescript
import { AuthProvider } from './contexts/AuthContext.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { LoginPage } from './pages/admin/LoginPage.js';

// Wrap routes in AuthProvider:
<AuthProvider>
  <Routes>
    {/* public routes */}
    <Route path="admin/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="admin" element={<div>Dashboard (WIP)</div>} />
    </Route>
  </Routes>
</AuthProvider>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/contexts/AuthContext.tsx frontend/src/components/ProtectedRoute.tsx frontend/src/pages/admin/LoginPage.tsx frontend/src/App.tsx
git commit -m "feat: add admin auth context, protected route, and login page"
```

---

### Task 7: TipTap editor and translation tabs

**Files:**
- Create: `frontend/src/admin/components/TipTapEditor.tsx`
- Create: `frontend/src/admin/components/TranslationTabs.tsx`

- [ ] **Step 1: Create TipTapEditor.tsx**

```typescript
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useCallback } from 'react';

interface TipTapEditorProps {
  content: string;
  onChange: (json: string) => void;
}

export function TipTapEditor({ content, onChange }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image.configure({ allowBase64: false }),
    ],
    content: content ? JSON.parse(content) : { type: 'doc', content: [] },
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
  });

  const addImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !editor) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/admin/media', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Upload failed');
        const { url } = await res.json() as { url: string };
        editor.chain().focus().setImage({ src: url }).run();
      } catch {
        alert('Image upload failed');
      }
    };
    input.click();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="tiptap-editor">
      <div className="tiptap-toolbar">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'active' : ''}>B</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'active' : ''}>I</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()}>List</button>
        <button onClick={() => editor.chain().focus().toggleBlockquote().run()}>Quote</button>
        <button onClick={() => { const url = window.prompt('Link URL:'); if (url) editor.chain().focus().setLink({ href: url }).run(); }}>Link</button>
        <button onClick={addImage}>Image</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
```

- [ ] **Step 2: Create TranslationTabs.tsx**

```typescript
import { useLanguages } from '../../api/languages.js';

interface TranslationTabsProps {
  activeLang: string;
  onSelectLang: (code: string) => void;
}

export function TranslationTabs({ activeLang, onSelectLang }: TranslationTabsProps) {
  const { data: languages } = useLanguages();
  if (!languages || languages.length <= 1) return null;

  return (
    <div className="translation-tabs" role="tablist">
      {languages.map(lang => (
        <button key={lang.id} role="tab" aria-selected={activeLang === lang.code}
          className={activeLang === lang.code ? 'active' : ''}
          onClick={() => onSelectLang(lang.code)}>
          {lang.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/admin/components/TipTapEditor.tsx frontend/src/admin/components/TranslationTabs.tsx
git commit -m "feat: add TipTap editor with toolbar, image upload, and translation tabs"
```

---

### Task 8: Admin layout, dashboard, and article editor

**Files:**
- Create: `frontend/src/admin/components/AdminLayout.tsx`
- Create: `frontend/src/pages/admin/DashboardPage.tsx`
- Create: `frontend/src/pages/admin/ArticleListPage.tsx`
- Create: `frontend/src/pages/admin/ArticleEditorPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create AdminLayout.tsx**

```typescript
import { Outlet, Link, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext.js';

export function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <nav>
          <Link to="/admin">Dashboard</Link>
          <Link to="/admin/articles">Articles</Link>
          <Link to="/admin/moments">Moments</Link>
          <Link to="/admin/resources">Resources</Link>
          <Link to="/admin/pages">Pages</Link>
          <Link to="/admin/categories">Categories</Link>
          <Link to="/admin/tags">Tags</Link>
          <Link to="/admin/languages">Languages</Link>
          <Link to="/admin/ui-strings">UI Strings</Link>
          <Link to="/admin/media">Media</Link>
        </nav>
        <button onClick={handleLogout}>Logout</button>
      </aside>
      <main className="admin-content"><Outlet /></main>
    </div>
  );
}
```

- [ ] **Step 2: Create DashboardPage.tsx**

```typescript
import { Link } from 'react-router';

export function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <div>
        <Link to="/admin/articles/new">New Article</Link>
        <Link to="/admin/moments/new">New Moment</Link>
        <Link to="/admin/resources/new">New Resource</Link>
        <Link to="/admin/pages/new">New Page</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ArticleListPage.tsx**

```typescript
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { adminList } from '../../api/admin.js';

export function ArticleListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-articles'],
    queryFn: () => adminList<{ data: { id: string; slug: string; translation_title: string; is_draft: number }[]; next_cursor: string | null }>('articles'),
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Articles</h1>
      <Link to="/admin/articles/new">New Article</Link>
      <table>
        <thead><tr><th>Title</th><th>Slug</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {data?.data.map(a => (
            <tr key={a.id}>
              <td>{a.translation_title}</td>
              <td>{a.slug}</td>
              <td>{a.is_draft ? 'Draft' : 'Published'}</td>
              <td><Link to={`/admin/articles/${a.id}`}>Edit</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create ArticleEditorPage.tsx**

```typescript
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

export function ArticleEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === 'new';

  const { data: languages } = useLanguages();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const [activeLang, setActiveLang] = useState('en');

  const [translations, setTranslations] = useState<Record<string, TransForm>>({});
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isDraft, setIsDraft] = useState(true);
  const [coverImage, setCoverImage] = useState('');

  const { data: article } = useQuery({
    queryKey: ['admin-article', id],
    queryFn: () => adminGet<ArticleDetail & { translations: { language_code: string; title: string; body: string; excerpt: string | null }[]; tag_ids: string[] }>('articles', id!),
    enabled: !isNew,
  });

  useEffect(() => {
    if (article) {
      setSlug(article.slug);
      setCategoryId(article.category?.id ?? '');
      setSelectedTagIds(article.tag_ids ?? []);
      setIsDraft(false);
      setCoverImage(article.cover_image ?? '');
      const transMap: Record<string, TransForm> = {};
      for (const t of (article as any).translations ?? []) {
        transMap[t.language_code] = { title: t.title, body: t.body, excerpt: t.excerpt ?? '' };
      }
      setTranslations(transMap);
    }
  }, [article]);

  // Set activeLang to first available language on mount
  useEffect(() => {
    if (languages && languages.length > 0 && !activeLang) {
      setActiveLang(languages[0]!.code);
    }
  }, [languages]);

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

  const current = translations[activeLang] ?? { title: '', body: '{}', excerpt: '' };

  function updateField(field: keyof TransForm, value: string) {
    setTranslations(prev => ({ ...prev, [activeLang]: { ...current, [field]: value } }));
  }

  return (
    <div>
      <h1>{isNew ? 'New Article' : 'Edit Article'}</h1>
      <TranslationTabs activeLang={activeLang} onSelectLang={setActiveLang} />
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="slug">Slug</label>
          <input id="slug" value={slug} onChange={e => setSlug(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="title">Title</label>
          <input id="title" value={current.title} onChange={e => updateField('title', e.target.value)} required />
        </div>
        <div>
          <label htmlFor="excerpt">Excerpt</label>
          <textarea id="excerpt" value={current.excerpt} onChange={e => updateField('excerpt', e.target.value)} />
        </div>
        <div>
          <label>Body</label>
          <TipTapEditor content={current.body} onChange={(json) => updateField('body', json)} />
        </div>
        <div>
          <label htmlFor="category">Category</label>
          <select id="category" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">None</option>
            {categories?.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.translation.name ?? cat.slug}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Tags</label>
          {tags?.map(tag => (
            <label key={tag.id}>
              <input type="checkbox" checked={selectedTagIds.includes(tag.id)}
                onChange={() => setSelectedTagIds(prev =>
                  prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                )} />
              {tag.translation.name ?? tag.slug}
            </label>
          ))}
        </div>
        <div>
          <label>
            <input type="checkbox" checked={isDraft} onChange={e => setIsDraft(e.target.checked)} />
            Draft
          </label>
        </div>
        <button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </button>
        {saveMutation.isError && <p className="error">Failed to save</p>}
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Wire admin routes in App.tsx**

```typescript
import { AdminLayout } from './admin/components/AdminLayout.js';
import { DashboardPage } from './pages/admin/DashboardPage.js';
import { ArticleListPage } from './pages/admin/ArticleListPage.js';
import { ArticleEditorPage } from './pages/admin/ArticleEditorPage.js';

// Replace the placeholder admin route with:
<Route element={<ProtectedRoute />}>
  <Route element={<AdminLayout />}>
    <Route path="admin" element={<DashboardPage />} />
    <Route path="admin/articles" element={<ArticleListPage />} />
    <Route path="admin/articles/new" element={<ArticleEditorPage />} />
    <Route path="admin/articles/:id" element={<ArticleEditorPage />} />
  </Route>
</Route>
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/admin/components/AdminLayout.tsx frontend/src/pages/admin/DashboardPage.tsx frontend/src/pages/admin/ArticleListPage.tsx frontend/src/pages/admin/ArticleEditorPage.tsx frontend/src/App.tsx
git commit -m "feat: add admin layout, dashboard, article list, and article editor"
```

---

### Task 9: Remaining admin pages

**Files:**
- Create: `frontend/src/pages/admin/MomentEditorPage.tsx`
- Create: `frontend/src/pages/admin/ResourceEditorPage.tsx`
- Create: `frontend/src/pages/admin/PageEditorPage.tsx`
- Create: `frontend/src/pages/admin/CategoryManagerPage.tsx`
- Create: `frontend/src/pages/admin/TagManagerPage.tsx`
- Create: `frontend/src/pages/admin/LanguageManagerPage.tsx`
- Create: `frontend/src/pages/admin/UIStringsPage.tsx`
- Create: `frontend/src/pages/admin/MediaPage.tsx`
- Modify: `frontend/src/App.tsx`

All admin editor pages follow the same pattern as ArticleEditorPage:
- Check if `isNew` from `useParams`
- Load existing data with `useQuery` if editing
- `useState` for each translatable field per language
- `TranslationTabs` for language switching
- `TipTapEditor` for body fields (moments, pages)
- `useMutation` for save, invalidates queries on success
- Simple input for slug/url/cover_image, checkbox for is_draft

Key differences per type:
- **MomentEditorPage** — no slug, no category, no cover_image, no draft. Only `published_at` + translations (body) + tags.
- **ResourceEditorPage** — url, cover_image, category_id. Translations (title, description).
- **PageEditorPage** — slug, is_draft, sort_order. Translations (title, body). Validate slug against reserved words before submitting.
- **CategoryManagerPage** — simple list + create form with slug + translation name.
- **TagManagerPage** — same as categories.
- **LanguageManagerPage** — list + create form with code, name, is_default. Enforce single default.
- **UIStringsPage** — select language, list all keys, edit values inline.
- **MediaPage** — list uploaded files, delete button, drag-and-drop upload zone.

Wire all routes in App.tsx under the AdminLayout.

- [ ] **Step 1: Create all remaining admin pages and wire routes**

Due to the established patterns, each page is straightforward. Create them all, then commit.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/admin/ frontend/src/App.tsx
git commit -m "feat: add all remaining admin CRUD pages"
```

---

### Task 10: Component tests and production build

**Files:**
- Create: `frontend/tests/components/ArticleCard.test.tsx`
- Create: `frontend/tests/components/LanguageSwitcher.test.tsx`
- Modify: `frontend/.gitignore`

- [ ] **Step 1: Create ArticleCard test**

Create `frontend/tests/components/ArticleCard.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ArticleCard } from '../../src/components/ArticleCard.js';

const mockArticle = {
  id: '1',
  slug: 'hello-world',
  cover_image: null,
  published_at: '2026-05-01T00:00:00Z',
  title: 'Hello World',
  excerpt: 'First post',
};

describe('ArticleCard', () => {
  it('renders title as link to article slug', () => {
    render(
      <MemoryRouter>
        <ArticleCard article={mockArticle} />
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Hello World' });
    expect(link.getAttribute('href')).toBe('/articles/hello-world');
  });

  it('renders excerpt text', () => {
    render(
      <MemoryRouter>
        <ArticleCard article={mockArticle} />
      </MemoryRouter>
    );
    expect(screen.getByText('First post')).toBeDefined();
  });
});
```

- [ ] **Step 2: Create LanguageSwitcher test**

Create `frontend/tests/components/LanguageSwitcher.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher.js';
import { LanguageProvider } from '../../src/contexts/LanguageContext.js';

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([
      { id: '1', code: 'en', name: 'English', is_default: 1 },
      { id: '2', code: 'zh', name: '中文', is_default: 0 },
    ]),
  } as Response);
  localStorage.clear();
});

function renderSwitcher() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <LanguageSwitcher />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe('LanguageSwitcher', () => {
  it('renders language options', async () => {
    renderSwitcher();
    expect(await screen.findByText('English')).toBeDefined();
    expect(screen.getByText('中文')).toBeDefined();
  });

  it('persists language selection to localStorage', async () => {
    renderSwitcher();
    const select = await screen.findByRole('combobox');
    await userEvent.selectOptions(select, 'zh');
    expect(localStorage.getItem('soli-isle-lang')).toBe('zh');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run`
Expected: all component tests PASS

- [ ] **Step 4: Run production build**

Run: `cd frontend && npx vite build`
Expected: creates `frontend/dist/` with `index.html` and hashed assets

Verify: `ls frontend/dist/` shows `index.html` and `assets/` directory

- [ ] **Step 5: Commit**

```bash
git add frontend/tests/ frontend/.gitignore
git commit -m "test: add component tests and verify production build"
```

---

## Plan Complete — Verification Checklist

- [ ] Dev server starts: `npm run dev` — SPA loads at `http://localhost:5173`
- [ ] API proxy works — requests to `/api/*` reach the Fastify backend
- [ ] Public pages render: `/`, `/articles`, `/articles/:slug`, `/moments`, `/resources`, `/:slug`
- [ ] Language switcher persists choice to `localStorage` and auto-detects `navigator.language`
- [ ] Admin login gate works — `/admin` redirects to `/admin/login` when unauthenticated
- [ ] Admin login sets cookie, subsequent admin requests include it
- [ ] Article editor: TipTap saves JSON, image upload posts to `/api/admin/media`, translation tabs work
- [ ] All admin CRUD pages (articles, moments, resources, pages, categories, tags, languages, UI strings, media) function
- [ ] `npx vitest run` — all component tests pass
- [ ] `npx vite build` — produces production-ready static files in `dist/`
