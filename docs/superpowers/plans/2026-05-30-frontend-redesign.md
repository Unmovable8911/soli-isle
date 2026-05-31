# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **VISUAL POLISH:** For every task that writes CSS or JSX markup, the implementer MUST invoke the `frontend-design:frontend-design` skill and apply the "Editorial Archive" identity from the spec. This plan fixes structure, tokens, contracts, and tests; the frontend-design skill supplies the production-grade visual execution within those constraints.

**Goal:** Replace the unwanted "Riso Archipelago" frontend with a modern, formal, animated "Editorial Archive" interface that supports light/dark themes, is fully responsive, fixes the admin's functional bugs, and adds an admin-managed social-links footer — all on the existing tech stack.

**Architecture:** A new semantic CSS token system (light/dark via `data-theme` on `<html>`) drives a modular stylesheet. A thin `ThemeProvider` (mirroring `LanguageContext`) handles system-default + persisted manual theming. React component logic is preserved; only markup/classNames change. The new full-stack social-links feature follows existing Fastify/Drizzle route conventions and is built last.

**Tech Stack:** Vite + React 19 + React Router 7 + TanStack Query + TipTap; Fastify + Drizzle + better-sqlite3; vanilla CSS; fonts self-hosted via Fontsource; Vitest + Testing Library; Playwright (`webapp-testing`) for admin verification.

**Spec:** `docs/superpowers/specs/2026-05-30-frontend-redesign-design.md`

---

## File Structure

**New files**
- `frontend/src/styles/tokens.css` — light/dark CSS custom properties.
- `frontend/src/styles/base.css` — reset, font faces, base typography.
- `frontend/src/styles/components.css` — shared class vocabulary (button, card, field, chip, tabs, badge, empty, toast).
- `frontend/src/styles/public.css` — public-site layouts.
- `frontend/src/styles/admin.css` — admin layouts.
- `frontend/src/styles/motion.css` — animations + reduced-motion guards.
- `frontend/src/contexts/ThemeContext.tsx` — `ThemeProvider`, `useTheme`.
- `frontend/src/components/ThemeToggle.tsx` — sun/moon toggle.
- `frontend/src/components/Footer.tsx` — extracted footer (social links land here in Phase 4).
- `frontend/src/hooks/useScrollReveal.ts` — IntersectionObserver reveal hook.
- `frontend/src/hooks/useToc.ts` — derives `TocEntry[]` from rendered article DOM; `slugify`.
- `frontend/src/components/ArticleToc.tsx` — floating/collapsible TOC with scroll-spy.
- `frontend/src/lib/social-catalog.tsx` — platform catalog + inline 2-color SVG icons.
- `frontend/src/api/social-links.ts` — public + admin social-link hooks/calls.
- `frontend/src/pages/admin/SocialLinksPage.tsx` — admin social manager.
- `backend/src/db/schema/social-links.ts` — `social_links` table.
- `backend/src/lib/social-catalog.ts` — allowed platform ids (validation).
- `backend/src/routes/public/social-links.ts` — `GET /api/social-links`.
- `backend/src/routes/admin/social-links.ts` — admin list + upsert.
- `backend/tests/admin/social-links.test.ts`, `backend/tests/public/social-links.test.ts`.
- Frontend tests: `frontend/tests/ThemeContext.test.tsx`, `frontend/tests/useToc.test.tsx`, `frontend/tests/Footer.test.tsx`, `frontend/tests/SocialLinksPage.test.tsx`.

**Modified files**
- `frontend/src/index.css` — becomes a thin set of `@import`s (the 2,052-line content is replaced).
- `frontend/index.html` — drop Google Fonts `<link>`, add no-flash theme script + `meta theme-color` handling.
- `frontend/src/App.tsx` — wrap in `ThemeProvider`; add `admin/social-links` route.
- `frontend/src/components/Layout.tsx` — new masthead (mobile drawer + `ThemeToggle`), use `Footer`.
- `frontend/src/admin/components/AdminLayout.tsx` — grouped nav, drawer, `ThemeToggle`, Social Links link.
- Public pages (Home/Articles/ArticleDetail/Moments/Resources/PageDetail) and admin pages — markup/className updates per task.
- `backend/src/app.ts`, `backend/tests/helpers.ts` — register social routes; add `social_links` to test SQL.
- `backend/src/db/schema/index.ts`, `backend/src/db/seed.ts` — export/seed social links.

---

## Phase 0 — Foundations (theme system + tokens + fonts)

### Task 0.1: Self-host fonts via Fontsource

**Files:**
- Modify: `frontend/package.json` (deps)
- Modify: `frontend/index.html`
- Create: `frontend/src/styles/base.css`

- [ ] **Step 1: Install Fontsource packages**

Run:
```bash
cd /home/kilian/code/soli-isle/frontend
npm install @fontsource-variable/fraunces @fontsource/schibsted-grotesk @fontsource-variable/newsreader @fontsource/space-mono
```
Expected: packages added to `dependencies`, no errors.

- [ ] **Step 2: Remove the Google Fonts link from `index.html`**

Delete the `<link rel="preconnect">` (x2) and the `<link ... fonts.googleapis.com ...>` stylesheet tags in `frontend/index.html`. Leave the `<title>` and viewport meta.

- [ ] **Step 3: Create `frontend/src/styles/base.css` importing the fonts and setting base typography**

```css
@import '@fontsource-variable/fraunces';
@import '@fontsource/schibsted-grotesk/400.css';
@import '@fontsource/schibsted-grotesk/500.css';
@import '@fontsource/schibsted-grotesk/700.css';
@import '@fontsource-variable/newsreader';
@import '@fontsource/space-mono/400.css';
@import '@fontsource/space-mono/700.css';

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
img, video, svg { display: block; max-width: 100%; }
button { font: inherit; cursor: pointer; border: none; background: none; color: inherit; }

html {
  font-size: 17px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  scroll-behavior: smooth;
}
body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-ui);
  font-size: 1rem;
  line-height: 1.6;
  min-height: 100dvh;
  transition: background-color var(--ease), color var(--ease);
}
::selection { background-color: var(--color-accent); color: var(--color-bg); }

h1, h2, h3, h4 { font-family: var(--font-display); line-height: 1.15; font-weight: 600; }
:where(a) { color: inherit; }

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
```

- [ ] **Step 4: Verify the dev server boots and fonts resolve**

Run:
```bash
cd /home/kilian/code/soli-isle/frontend && npm run build
```
Expected: build succeeds (token vars are defined in Task 0.2; if running before 0.2, run after). Commit after Task 0.2.

### Task 0.2: Token system (light + dark)

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Create `frontend/src/styles/tokens.css`**

```css
:root {
  --font-display: 'Fraunces Variable', Georgia, serif;
  --font-ui: 'Schibsted Grotesk', ui-sans-serif, sans-serif;
  --font-read: 'Newsreader Variable', Georgia, serif;
  --font-mono: 'Space Mono', ui-monospace, monospace;

  --space-xs: 0.25rem; --space-sm: 0.5rem; --space-md: 1rem;
  --space-lg: 1.75rem; --space-xl: 3rem; --space-2xl: 5rem;
  --content-width: 680px; --wide-width: 1100px; --header-height: 68px;
  --radius: 10px; --radius-sm: 6px;
  --ease: 220ms cubic-bezier(0.22, 1, 0.36, 1);
  --spring: 380ms cubic-bezier(0.34, 1.4, 0.64, 1);
}

:root, :root[data-theme='light'] {
  --color-bg: #FAF8F3;
  --color-surface: #FFFFFF;
  --color-elevated: #F2EEE6;
  --color-text: #1A1814;
  --color-muted: #6B6358;
  --color-border: #E7E1D6;
  --color-accent: #14604A;
  --color-accent-hover: #0F4D3B;
  --color-accent-soft: #E0EDE7;
  --color-danger: #A23B2D;
  --color-focus: #14604A;
  --shadow-sm: 0 1px 2px rgba(26,24,20,0.06), 0 2px 8px rgba(26,24,20,0.05);
  --shadow-md: 0 4px 16px rgba(26,24,20,0.10);
}

:root[data-theme='dark'] {
  --color-bg: #15140F;
  --color-surface: #1E1C17;
  --color-elevated: #262219;
  --color-text: #ECE7DE;
  --color-muted: #9A9286;
  --color-border: #2A2722;
  --color-accent: #3FAE86;
  --color-accent-hover: #58C49C;
  --color-accent-soft: #1C3A30;
  --color-danger: #E07A6A;
  --color-focus: #3FAE86;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.4), 0 2px 10px rgba(0,0,0,0.35);
  --shadow-md: 0 6px 24px rgba(0,0,0,0.5);
}

:where(:focus-visible) { outline: 2px solid var(--color-focus); outline-offset: 2px; }
```

- [ ] **Step 2: Replace `frontend/src/index.css` with imports (order matters)**

```css
@import './styles/tokens.css';
@import './styles/base.css';
@import './styles/components.css';
@import './styles/public.css';
@import './styles/admin.css';
@import './styles/motion.css';
```

- [ ] **Step 3: Create empty placeholder files so imports resolve**

Run:
```bash
cd /home/kilian/code/soli-isle/frontend/src/styles
: > components.css; : > public.css; : > admin.css; : > motion.css
```

- [ ] **Step 4: Verify build**

Run: `cd /home/kilian/code/soli-isle/frontend && npm run build`
Expected: PASS (blank but valid styles).

- [ ] **Step 5: Commit**

```bash
cd /home/kilian/code/soli-isle && git add frontend/package.json frontend/package-lock.json frontend/index.html frontend/src/index.css frontend/src/styles
git commit -m "feat(frontend): add Fontsource fonts and light/dark token system"
```

### Task 0.3: No-flash theme bootstrap script

**Files:**
- Modify: `frontend/index.html`

- [ ] **Step 1: Add the bootstrap script in `<head>` (before the module script)**

```html
<meta name="theme-color" content="#FAF8F3" />
<script>
  (function () {
    try {
      var stored = localStorage.getItem('soli-isle-theme');
      var theme = stored === 'light' || stored === 'dark'
        ? stored
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  })();
</script>
```

- [ ] **Step 2: Verify build**

Run: `cd /home/kilian/code/soli-isle/frontend && npm run build`
Expected: PASS.

### Task 0.4: ThemeProvider + useTheme (TDD)

**Files:**
- Create: `frontend/src/contexts/ThemeContext.tsx`
- Test: `frontend/tests/ThemeContext.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, act } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext.js';

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme} data-theme-value={theme}>{theme}</button>;
}

describe('ThemeProvider', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme'); });

  it('defaults to light when no stored choice and system is light', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(screen.getByRole('button').textContent).toBe('light');
  });

  it('uses the stored choice over system', () => {
    localStorage.setItem('soli-isle-theme', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggles and persists', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => { screen.getByRole('button').click(); });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('soli-isle-theme')).toBe('dark');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/kilian/code/soli-isle/frontend && npx vitest run tests/ThemeContext.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `ThemeContext.tsx`**

```tsx
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'soli-isle-theme';

interface ThemeContextValue { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void; }
const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitial(): { theme: Theme; explicit: boolean } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return { theme: stored, explicit: true };
  } catch { /* ignore */ }
  const prefersDark = typeof window !== 'undefined'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return { theme: prefersDark ? 'dark' : 'light', explicit: false };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = resolveInitial();
  const [theme, setThemeState] = useState<Theme>(initial.theme);
  const [explicit, setExplicit] = useState(initial.explicit);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  // Follow system changes only until the user makes an explicit choice
  useEffect(() => {
    if (explicit) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setThemeState(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [explicit]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t); setExplicit(true);
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
  }, []);
  const toggleTheme = useCallback(() => { setTheme(theme === 'dark' ? 'light' : 'dark'); }, [theme, setTheme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

Note: `toggleTheme` reads `theme` from closure; the test clicks once so this is correct. (Implementer: keep the `theme` dep on `toggleTheme`.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/kilian/code/soli-isle/frontend && npx vitest run tests/ThemeContext.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/kilian/code/soli-isle && git add frontend/src/contexts/ThemeContext.tsx frontend/tests/ThemeContext.test.tsx frontend/index.html
git commit -m "feat(frontend): add ThemeProvider with system default and persisted toggle"
```

### Task 0.5: Wrap App in ThemeProvider + ThemeToggle component

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/components/ThemeToggle.tsx`

- [ ] **Step 1: Create `ThemeToggle.tsx`**

```tsx
import { useTheme } from '../contexts/ThemeContext.js';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <span className="theme-toggle__icon" aria-hidden="true">{isDark ? '☾' : '☀'}</span>
    </button>
  );
}
```
(Implementer: replace the glyphs with inline 2-color sun/moon SVGs during the frontend-design pass; keep the class names and a11y attributes.)

- [ ] **Step 2: Wrap providers in `App.tsx`**

Add `import { ThemeProvider } from './contexts/ThemeContext.js';` and wrap the existing `<LanguageProvider>` so the outermost provider order is `QueryClientProvider > ThemeProvider > LanguageProvider > AuthProvider > BrowserRouter`.

- [ ] **Step 3: Verify build**

Run: `cd /home/kilian/code/soli-isle/frontend && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /home/kilian/code/soli-isle && git add frontend/src/App.tsx frontend/src/components/ThemeToggle.tsx
git commit -m "feat(frontend): mount ThemeProvider and add ThemeToggle"
```

---

## Phase 1 — Shared vocabulary + motion primitives

### Task 1.1: components.css — shared class vocabulary

**Files:**
- Modify: `frontend/src/styles/components.css`

- [ ] **Step 1: Write the shared component classes** (invoke frontend-design skill; this is the structural baseline to refine)

```css
/* Buttons */
.btn { display: inline-flex; align-items: center; gap: .5rem; padding: .55rem 1.1rem;
  border-radius: var(--radius-sm); font-weight: 500; font-family: var(--font-ui);
  background: var(--color-accent); color: #fff; transition: transform var(--ease), background var(--ease), box-shadow var(--ease); }
.btn:hover { background: var(--color-accent-hover); }
.btn:active { transform: translateY(1px); }
.btn--ghost { background: transparent; color: var(--color-text); border: 1px solid var(--color-border); }
.btn--ghost:hover { background: var(--color-elevated); }
.btn--danger { background: transparent; color: var(--color-danger); border: 1px solid var(--color-border); }
.btn--danger:hover { background: color-mix(in srgb, var(--color-danger) 12%, transparent); }
.btn:disabled { opacity: .55; cursor: not-allowed; }

/* Card */
.card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius);
  box-shadow: var(--shadow-sm); transition: transform var(--ease), box-shadow var(--ease); }
.card--interactive:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }

/* Eyebrow / meta label */
.eyebrow { font-family: var(--font-ui); font-size: .72rem; letter-spacing: .12em; text-transform: uppercase;
  color: var(--color-accent); font-weight: 600; }
.meta { font-family: var(--font-mono); font-size: .8rem; color: var(--color-muted); }

/* Form field */
.field { display: flex; flex-direction: column; gap: .35rem; }
.field > label { font-size: .85rem; font-weight: 500; color: var(--color-muted); }
.field input, .field textarea, .field select { width: 100%; padding: .55rem .7rem; font: inherit;
  background: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); transition: border-color var(--ease), box-shadow var(--ease); }
.field input:focus, .field textarea:focus, .field select:focus { border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft); outline: none; }

/* Chip / tag */
.chip { display: inline-flex; padding: .2rem .65rem; border-radius: 999px; font-size: .8rem;
  background: var(--color-accent-soft); color: var(--color-accent); border: 1px solid transparent; }
a.chip:hover { border-color: var(--color-accent); }

/* Badge */
.badge { font-family: var(--font-mono); font-size: .7rem; padding: .15rem .5rem; border-radius: 4px;
  border: 1px solid var(--color-border); color: var(--color-muted); }
.badge--draft { color: var(--color-danger); border-color: color-mix(in srgb, var(--color-danger) 40%, var(--color-border)); }
.badge--published { color: var(--color-accent); border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border)); }

/* Tabs */
.tabs { display: flex; gap: .25rem; border-bottom: 1px solid var(--color-border); }
.tabs button { padding: .5rem .9rem; border-bottom: 2px solid transparent; color: var(--color-muted); }
.tabs button.active, .tabs button[aria-selected='true'] { color: var(--color-text); border-bottom-color: var(--color-accent); }

/* Empty + error + loading */
.empty-state { text-align: center; color: var(--color-muted); padding: var(--space-xl) var(--space-md); }
.error { color: var(--color-danger); font-size: .9rem; }
.skeleton { background: linear-gradient(90deg, var(--color-elevated), var(--color-surface), var(--color-elevated));
  background-size: 200% 100%; border-radius: var(--radius-sm); animation: skeleton 1.2s ease-in-out infinite; }

/* Toast */
.toast { position: fixed; bottom: 1.25rem; right: 1.25rem; z-index: 60; background: var(--color-surface);
  border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow-md);
  padding: .75rem 1rem; }
.toast--error { border-color: var(--color-danger); }
```

- [ ] **Step 2: Verify build**

Run: `cd /home/kilian/code/soli-isle/frontend && npm run build`
Expected: PASS.

### Task 1.2: motion.css + useScrollReveal hook (TDD)

**Files:**
- Modify: `frontend/src/styles/motion.css`
- Create: `frontend/src/hooks/useScrollReveal.ts`
- Test: `frontend/tests/useScrollReveal.test.tsx`

- [ ] **Step 1: Write motion.css**

```css
@keyframes skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.reveal { opacity: 0; transform: translateY(14px); transition: opacity var(--spring), transform var(--spring); }
.reveal.is-revealed { opacity: 1; transform: none; }

.link-underline { position: relative; }
.link-underline::after { content: ''; position: absolute; left: 0; bottom: -2px; height: 1.5px; width: 100%;
  background: var(--color-accent); transform: scaleX(0); transform-origin: left; transition: transform var(--ease); }
.link-underline:hover::after, .link-underline.active::after { transform: scaleX(1); }

@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
}
::view-transition-old(root), ::view-transition-new(root) { animation-duration: 220ms; }
```

- [ ] **Step 2: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useScrollReveal } from '../src/hooks/useScrollReveal.js';

let lastCallback: (entries: { isIntersecting: boolean; target: Element }[]) => void;
beforeEach(() => {
  lastCallback = () => {};
  // @ts-expect-error test stub
  global.IntersectionObserver = class {
    constructor(cb: typeof lastCallback) { lastCallback = cb; }
    observe() {} unobserve() {} disconnect() {}
  };
});

function Probe() { const ref = useScrollReveal<HTMLDivElement>(); return <div ref={ref} className="reveal">x</div>; }

describe('useScrollReveal', () => {
  it('adds is-revealed when the element intersects', () => {
    const { container } = render(<Probe />);
    const el = container.querySelector('.reveal')!;
    expect(el.classList.contains('is-revealed')).toBe(false);
    lastCallback([{ isIntersecting: true, target: el }]);
    expect(el.classList.contains('is-revealed')).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd /home/kilian/code/soli-isle/frontend && npx vitest run tests/useScrollReveal.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `useScrollReveal.ts`**

```ts
import { useCallback, useRef } from 'react';

export function useScrollReveal<T extends HTMLElement>() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  return useCallback((node: T | null) => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') { node.classList.add('is-revealed'); return; }
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('is-revealed'); obs.unobserve(e.target); }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    obs.observe(node);
    observerRef.current = obs;
  }, []);
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd /home/kilian/code/soli-isle/frontend && npx vitest run tests/useScrollReveal.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/kilian/code/soli-isle && git add frontend/src/styles/components.css frontend/src/styles/motion.css frontend/src/hooks/useScrollReveal.ts frontend/tests/useScrollReveal.test.tsx
git commit -m "feat(frontend): add shared component styles, motion, and scroll-reveal hook"
```

---

## Phase 2 — Public site restyle

> For each task below: invoke `frontend-design:frontend-design`, apply the Editorial Archive identity, keep all data/query logic unchanged, and write the page-specific CSS into `frontend/src/styles/public.css`. Verify each with `npm run build` and a Playwright screenshot (light + dark) before committing.

### Task 2.1: Layout masthead (sticky, mobile drawer, theme toggle) + Footer extraction

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/Footer.tsx`
- Modify: `frontend/src/styles/public.css`

- [ ] **Step 1: Rewrite `Layout.tsx`**

```tsx
import { useState } from 'react';
import { Outlet, Link, NavLink } from 'react-router';
import { LanguageSwitcher } from './LanguageSwitcher.js';
import { ThemeToggle } from './ThemeToggle.js';
import { Footer } from './Footer.js';

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="layout">
      <header className="masthead">
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>Soli&nbsp;Isle</Link>
        <button type="button" className="masthead__burger" aria-label="Menu"
          aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}>≡</button>
        <nav className={`masthead__nav${menuOpen ? ' is-open' : ''}`} onClick={() => setMenuOpen(false)}>
          <NavLink to="/" end className="link-underline">Home</NavLink>
          <NavLink to="/articles" className="link-underline">Articles</NavLink>
          <NavLink to="/moments" className="link-underline">Moments</NavLink>
          <NavLink to="/resources" className="link-underline">Resources</NavLink>
        </nav>
        <div className="masthead__actions">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main><Outlet /></main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Create `Footer.tsx`** (social links added in Phase 4; basic footer for now)

```tsx
import { Link } from 'react-router';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <strong>Soli Isle</strong>
        <p>An archipelago of essays, moments &amp; finds</p>
      </div>
      <nav className="site-footer__nav">
        <Link to="/articles">Articles</Link>
        <Link to="/moments">Moments</Link>
        <Link to="/resources">Resources</Link>
      </nav>
    </footer>
  );
}
```

- [ ] **Step 3: Add masthead/footer CSS to `public.css`** (frontend-design pass — sticky header with scroll border/blur, centered nav, mobile drawer under `@media (max-width: 640px)` toggled by `.is-open`, ≥44px tap targets).

- [ ] **Step 4: Verify + screenshot**

Run: `cd /home/kilian/code/soli-isle/frontend && npm run build`. Then use `webapp-testing` to screenshot `/` in light and dark and at 375px width. Expected: sticky header, working drawer, theme toggle flips palette.

- [ ] **Step 5: Commit**

```bash
cd /home/kilian/code/soli-isle && git add frontend/src/components/Layout.tsx frontend/src/components/Footer.tsx frontend/src/styles/public.css
git commit -m "feat(frontend): redesign masthead with mobile drawer, theme toggle, footer"
```

### Task 2.2: Home feed (article cards + inline moments, scroll-reveal)

**Files:**
- Modify: `frontend/src/pages/public/HomePage.tsx`, `frontend/src/components/ArticleCard.tsx`, `frontend/src/components/MomentCard.tsx`
- Modify: `frontend/src/styles/public.css`

- [ ] **Step 1:** Read the three files. Re-mark them with the new vocabulary: `ArticleCard` → `<article class="card card--interactive article-card reveal">` with cover, `.eyebrow` category, Fraunces `<h3>` title, excerpt, `.meta` date; attach `useScrollReveal` ref. `MomentCard` → compact `.moment-card.reveal` (no cover, body + date), visually distinct. Keep all props/data unchanged.
- [ ] **Step 2:** Write the corresponding CSS in `public.css` (feed container `max-width: var(--wide-width)`, responsive grid → single column ≤640px). frontend-design pass.
- [ ] **Step 3:** Verify build + screenshot `/` light/dark/mobile.
- [ ] **Step 4: Commit** `feat(frontend): redesign home feed cards`.

### Task 2.3: Articles list (filter bar + grid)

**Files:** `frontend/src/pages/public/ArticlesPage.tsx`, `frontend/src/components/FilterBar.tsx`, `frontend/src/components/InfiniteScroll.tsx` (unchanged logic), `frontend/src/styles/public.css`.

- [ ] **Step 1:** Restyle FilterBar to use `.chip`/`.btn--ghost` controls; keep query-param logic. Article grid reuses `.article-card`.
- [ ] **Step 2:** CSS in `public.css`. frontend-design pass.
- [ ] **Step 3:** Verify build + screenshot `/articles` light/dark/mobile; confirm filtering + infinite scroll still work via Playwright.
- [ ] **Step 4: Commit** `feat(frontend): redesign articles list and filter bar`.

### Task 2.4: useToc hook + slugify (TDD)

**Files:**
- Create: `frontend/src/hooks/useToc.ts`
- Test: `frontend/tests/useToc.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useRef } from 'react';
import { useToc, slugify } from '../src/hooks/useToc.js';

describe('slugify', () => {
  it('lowercases, trims, hyphenates', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('  A  B  ')).toBe('a-b');
  });
});

function Probe({ html, onToc }: { html: string; onToc: (t: unknown) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const toc = useToc(ref, [html]);
  onToc(toc);
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}

describe('useToc', () => {
  it('builds entries from h2/h3 and assigns ids', () => {
    let result: any;
    const { container } = render(
      <Probe html="<h2>First</h2><h3>Sub</h3><p>x</p><h2>Second</h2>" onToc={(t) => { result = t; }} />
    );
    expect(result).toEqual([
      { id: 'first', text: 'First', level: 2 },
      { id: 'sub', text: 'Sub', level: 3 },
      { id: 'second', text: 'Second', level: 2 },
    ]);
    expect(container.querySelector('#first')).not.toBeNull();
    expect(container.querySelector('#second')).not.toBeNull();
  });

  it('dedupes repeated heading slugs', () => {
    let result: any;
    render(<Probe html="<h2>Dup</h2><h2>Dup</h2>" onToc={(t) => { result = t; }} />);
    expect(result.map((e: any) => e.id)).toEqual(['dup', 'dup-2']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/kilian/code/soli-isle/frontend && npx vitest run tests/useToc.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `useToc.ts`**

```ts
import { useEffect, useState, type RefObject } from 'react';

export interface TocEntry { id: string; text: string; level: 2 | 3; }

export function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function useToc(ref: RefObject<HTMLElement | null>, deps: unknown[]): TocEntry[] {
  const [entries, setEntries] = useState<TocEntry[]>([]);
  useEffect(() => {
    const root = ref.current;
    if (!root) { setEntries([]); return; }
    const headings = Array.from(root.querySelectorAll('h2, h3')) as HTMLElement[];
    const seen = new Map<string, number>();
    const next: TocEntry[] = headings.map((h) => {
      const text = h.textContent?.trim() ?? '';
      const base = slugify(text) || 'section';
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count + 1}`;
      h.id = id;
      return { id, text, level: h.tagName === 'H3' ? 3 : 2 };
    });
    setEntries(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return entries;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/kilian/code/soli-isle/frontend && npx vitest run tests/useToc.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit** `feat(frontend): add useToc hook and slugify`.

### Task 2.5: ArticleToc component + article detail reading layout

**Files:**
- Create: `frontend/src/components/ArticleToc.tsx`
- Modify: `frontend/src/pages/public/ArticleDetailPage.tsx`
- Modify: `frontend/src/styles/public.css`

- [ ] **Step 1: Create `ArticleToc.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { TocEntry } from '../hooks/useToc.js';

export function ArticleToc({ entries }: { entries: TocEntry[] }) {
  const [active, setActive] = useState<string>('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (entries.length === 0) return;
    const obs = new IntersectionObserver((items) => {
      for (const it of items) if (it.isIntersecting) setActive((it.target as HTMLElement).id);
    }, { rootMargin: '0px 0px -70% 0px', threshold: 0 });
    for (const e of entries) { const el = document.getElementById(e.id); if (el) obs.observe(el); }
    return () => obs.disconnect();
  }, [entries]);

  if (entries.length < 2) return null;

  return (
    <nav className={`article-toc${open ? ' is-open' : ''}`} aria-label="Table of contents">
      <button type="button" className="article-toc__toggle" aria-expanded={open}
        onClick={() => setOpen(o => !o)}>Contents</button>
      <ul className="article-toc__list">
        {entries.map((e) => (
          <li key={e.id} className={`article-toc__item article-toc__item--l${e.level}`}>
            <a href={`#${e.id}`} className={active === e.id ? 'active' : ''}
              onClick={() => setOpen(false)}>{e.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Update `ArticleDetailPage.tsx` to derive TOC from the rendered body and render `ArticleToc`**

```tsx
import { useRef } from 'react';
import { useParams, Link } from 'react-router';
import { useArticle } from '../../api/articles.js';
import { RichContent } from '../../components/RichContent.js';
import { useToc } from '../../hooks/useToc.js';
import { ArticleToc } from '../../components/ArticleToc.js';

export function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: article, isLoading, error } = useArticle(slug!);
  const bodyRef = useRef<HTMLDivElement>(null);
  const toc = useToc(bodyRef, [article?.translation.body]);

  if (isLoading) return <div className="page-loading"><span className="skeleton" style={{height:'2rem',width:'60%',display:'block'}} /></div>;
  if (error || !article) return <div className="empty-state">Article not found</div>;

  return (
    <div className="article-layout">
      <article className="article-detail">
        <Link to="/articles" className="back-link link-underline">← Articles</Link>
        <header className="article-detail__header">
          {article.category && <span className="eyebrow">{article.category.translation.name ?? article.category.slug}</span>}
          <h1>{article.translation.title}</h1>
          <time className="meta" dateTime={article.published_at}>{new Date(article.published_at).toLocaleDateString()}</time>
        </header>
        {article.cover_image && <img src={article.cover_image} alt="" className="article-cover" />}
        <div className="article-body" ref={bodyRef}>
          <RichContent content={article.translation.body} />
        </div>
        {article.tags.length > 0 && (
          <div className="article-tags">
            {article.tags.map(tag => (
              <Link key={tag.id} to={`/articles?tag=${tag.slug}`} className="chip">{tag.translation.name ?? tag.slug}</Link>
            ))}
          </div>
        )}
      </article>
      <aside className="article-aside"><ArticleToc entries={toc} /></aside>
    </div>
  );
}
```

- [ ] **Step 3: CSS in `public.css`** (frontend-design pass): `.article-layout` is a centered single reading column (`--content-width`) with a sticky `.article-aside` in the right margin on `≥1024px`; below that the TOC collapses (`.article-toc__list` hidden until `.is-open`, toggled by the button). `.article-body` uses `var(--font-read)`, generous line-height, styled headings/blockquote/img/code/links. `scroll-margin-top: calc(var(--header-height) + 1rem)` on `h2, h3` inside `.article-body`.
- [ ] **Step 4: Verify build + Playwright**: screenshot `/articles/:slug` desktop (TOC visible, scroll-spy highlights active) and mobile (Contents button toggles list). Confirm anchor links scroll to headings.
- [ ] **Step 5: Commit** `feat(frontend): add article reading layout with floating TOC`.

### Task 2.6: Moments timeline, Resources cards, Pages reading layout

**Files:** `frontend/src/pages/public/MomentsPage.tsx`, `frontend/src/pages/public/ResourcesPage.tsx`, `frontend/src/components/ResourceCard.tsx`, `frontend/src/pages/public/PageDetailPage.tsx`, `frontend/src/styles/public.css`.

- [ ] **Step 1:** Moments → vertical `.timeline` of `.moment-card.reveal`. Resources → grid of `.card.resource-card` (cover, title, `.eyebrow` category, description, external-link affordance with `target="_blank" rel="noopener"`). PageDetail → same `.article-detail`/`.article-body` reading layout **without** `ArticleToc` (no TOC for custom pages, per spec). Keep all data logic.
- [ ] **Step 2:** CSS for `.timeline`, `.resource-card`. frontend-design pass.
- [ ] **Step 3:** Verify build + screenshots of `/moments`, `/resources`, a page slug (light/dark/mobile). Confirm no TOC on pages.
- [ ] **Step 4: Commit** `feat(frontend): redesign moments, resources, and page layouts`.

### Task 2.7: Loading/empty/error states across public pages

**Files:** the public pages above + `frontend/src/styles/components.css`.

- [ ] **Step 1:** Replace bare "Loading…" with `.skeleton` placeholders and bare "not found"/empty with `.empty-state`. Surface query errors with `.error` + a retry button calling the query's `refetch`.
- [ ] **Step 2:** Verify build; Playwright check an empty list and an offline/error path.
- [ ] **Step 3: Commit** `feat(frontend): consistent loading, empty, and error states (public)`.

---

## Phase 3 — Admin restyle + functional bug fixes

> Goal: make admin consistent with the public design (shared tokens, themed light/dark) and fix real bugs found by exercising it. Write admin CSS into `frontend/src/styles/admin.css`. Remove the hardcoded dark palette block (`.admin-layout, .login-page { ... }`) that lived in the old `index.css` — admin now uses the shared tokens.

### Task 3.1: AdminLayout (grouped nav, drawer, theme toggle)

**Files:** `frontend/src/admin/components/AdminLayout.tsx`, `frontend/src/styles/admin.css`.

- [ ] **Step 1: Rewrite `AdminLayout.tsx`** with grouped nav, a mobile drawer toggle, and `ThemeToggle`:

```tsx
import { useState } from 'react';
import { Outlet, Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext.js';
import { ThemeToggle } from '../../components/ThemeToggle.js';

const NAV = [
  { group: 'Content', links: [['/admin', 'Dashboard'], ['/admin/articles', 'Articles'], ['/admin/moments', 'Moments'], ['/admin/resources', 'Resources'], ['/admin/pages', 'Pages']] },
  { group: 'Taxonomy', links: [['/admin/categories', 'Categories'], ['/admin/tags', 'Tags']] },
  { group: 'System', links: [['/admin/languages', 'Languages'], ['/admin/ui-strings', 'UI Strings'], ['/admin/media', 'Media'], ['/admin/social-links', 'Social Links']] },
];

export function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  async function handleLogout() { try { await logout(); } catch { /* ignore */ } navigate('/admin/login'); }

  return (
    <div className={`admin-layout${open ? ' is-open' : ''}`}>
      <button type="button" className="admin-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>≡</button>
      <aside className="admin-sidebar">
        <Link to="/admin" className="admin-brand" onClick={() => setOpen(false)}>Soli Isle</Link>
        <nav onClick={() => setOpen(false)}>
          {NAV.map(({ group, links }) => (
            <div key={group} className="admin-nav-group">
              <p className="admin-nav-group__label">{group}</p>
              {links.map(([to, label]) => (
                <NavLink key={to} to={to} end={to === '/admin'}>{label}</NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar__footer">
          <ThemeToggle />
          <button type="button" className="btn btn--ghost" onClick={handleLogout}>Logout</button>
        </div>
      </aside>
      <main className="admin-content"><Outlet /></main>
    </div>
  );
}
```
(The `/admin/social-links` route is wired in Phase 4; the link is harmless until then or add it in 4.)

- [ ] **Step 2:** Write `admin.css` (frontend-design pass): sidebar + content grid; on `≤1024px` sidebar becomes an off-canvas drawer toggled by `.is-open`. Themed via shared tokens.
- [ ] **Step 3:** Verify build + screenshot `/admin` light/dark/mobile.
- [ ] **Step 4: Commit** `feat(admin): themed sidebar layout with grouped nav and drawer`.

### Task 3.2: Login page restyle

**Files:** `frontend/src/pages/admin/LoginPage.tsx`, `frontend/src/styles/admin.css`.

- [ ] **Step 1:** Restyle to a centered `.card` with `.field` + `.btn`, themed. Keep auth logic.
- [ ] **Step 2:** Verify build + screenshot.
- [ ] **Step 3: Commit** `feat(admin): restyle login page`.

### Task 3.3: List pages → data tables that reflow to cards

**Files:** `frontend/src/pages/admin/ArticleListPage.tsx`, `MomentListPage.tsx`, `ResourceListPage.tsx`, `PageListPage.tsx`, `frontend/src/styles/admin.css`.

- [ ] **Step 1:** Read each. Convert to a `.admin-table` with headers, `.badge--draft`/`.badge--published` status, right-aligned row actions (`.btn--ghost` edit, `.btn--danger` delete) with a `window.confirm` delete guard. Keep all queries/mutations.
- [ ] **Step 2:** CSS: `.admin-table`; under `≤640px` rows reflow into stacked `.card`s (label/value pairs via `data-label` + `::before`). frontend-design pass.
- [ ] **Step 3:** Verify build + Playwright: each list renders, delete confirm works.
- [ ] **Step 4: Commit** `feat(admin): table list pages with responsive card reflow`.

### Task 3.4: Editor pages → two-column layout

**Files:** `frontend/src/pages/admin/ArticleEditorPage.tsx`, `MomentEditorPage.tsx`, `ResourceEditorPage.tsx`, `PageEditorPage.tsx`, `frontend/src/admin/components/TipTapEditor.tsx`, `frontend/src/admin/components/TranslationTabs.tsx`, `frontend/src/styles/admin.css`.

- [ ] **Step 1:** Wrap editor forms in `.admin-editor` two-column grid: main column (title, body, excerpt) + `.admin-editor__aside` metadata panel (slug, category, tags, cover, draft toggle, Save). Move `TranslationTabs` above content using `.tabs`. Style the TipTap toolbar with `.btn--ghost` icon buttons. Keep all state/mutation logic intact.
- [ ] **Step 2:** CSS: two-column grid collapsing to single column with aside below content at `≤1024px`. frontend-design pass.
- [ ] **Step 3:** Verify build + Playwright: open each editor, switch translation tabs (body updates), save.
- [ ] **Step 4: Commit** `feat(admin): two-column editor layout`.

### Task 3.5: Manager pages restyle (categories, tags, languages, UI strings, media)

**Files:** `frontend/src/pages/admin/CategoryManagerPage.tsx`, `TagManagerPage.tsx`, `LanguageManagerPage.tsx`, `UIStringsPage.tsx`, `MediaPage.tsx`, `DashboardPage.tsx`, `frontend/src/styles/admin.css`.

- [ ] **Step 1:** Apply `.admin-manager-layout`, `.field`, `.btn`, `.admin-item-list` styling consistently. Fix the stray indentation/duplicate-error markup in `CategoryManagerPage.tsx` (the `deleteError` paragraph is nested oddly in the create form — move it next to the list). Dashboard → themed stat cards. Keep logic.
- [ ] **Step 2:** Verify build + screenshots.
- [ ] **Step 3: Commit** `feat(admin): restyle manager and dashboard pages`.

### Task 3.6: Admin bug audit + fixes (Playwright)

**Files:** as needed based on findings; likely `frontend/src/api/client.ts`, `frontend/src/admin/components/TipTapEditor.tsx`, individual pages. Add/adjust tests under `frontend/tests/`.

- [ ] **Step 1: Stand up the app for E2E.** Start backend (`cd backend && npm run db:migrate && npm run db:seed && npx tsx src/index.ts`) and frontend (`cd frontend && npm run dev`). Use `webapp-testing` (Playwright) to log into `/admin/login` with the seeded admin password.
- [ ] **Step 2: Exercise every admin flow** and record each defect (reproduction + expected): create/edit/delete for articles, moments, resources, pages; translation-tab switching; category/tag/language/UI-string managers; **media upload** (single + multiple); slug-collision error surfacing.
- [ ] **Step 3: Verify the `?lang=` leak.** Confirm whether `api/client.ts` appending the stored `lang` param to `/admin/*` GETs filters admin data (e.g. an editor losing translations when a non-default language is stored). If so, fix by not sending `lang` for admin paths:

```ts
// in apiFetch, before setting the param:
const isAdmin = path.startsWith('/admin/');
const lang = options?.lang ?? (isAdmin ? undefined : localStorage.getItem('soli-isle-lang'));
if (lang) url.searchParams.set('lang', lang);
```
Add a regression test in `frontend/tests/apiClient.test.ts` asserting `lang` is omitted for `/admin/*` and present for public paths (mock `fetch`, assert the URL).

- [ ] **Step 4:** For each confirmed bug, write a failing test (component or API-client level) where feasible, fix it, and re-run. Bugs not unit-testable get a documented Playwright reproduction + manual re-verification.
- [ ] **Step 5: Run the full suites.** `cd frontend && npm test` and `cd backend && npm test` — all green.
- [ ] **Step 6: Commit** `fix(admin): resolve functional bugs found in E2E audit` (one commit per logical fix is fine).

---

## Phase 4 — Admin-managed social links (full-stack, LAST)

> Built last per the user's instruction. Backend first (TDD), then frontend.

### Task 4.1: social_links schema + test-helper table + migration

**Files:**
- Create: `backend/src/db/schema/social-links.ts`
- Create: `backend/src/lib/social-catalog.ts`
- Modify: `backend/src/db/schema/index.ts`
- Modify: `backend/tests/helpers.ts`

- [ ] **Step 1: Create `social-catalog.ts`**

```ts
export const SOCIAL_PLATFORMS = [
  'github', 'twitter', 'tiktok', 'telegram', 'instagram', 'facebook', 'reddit', 'email', 'rss',
] as const;
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number];
export function isSocialPlatform(v: string): v is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(v);
}
```

- [ ] **Step 2: Create `social-links.ts` schema**

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const socialLinks = sqliteTable('social_links', {
  id: text('id').primaryKey(),
  platform: text('platform').notNull().unique(),
  url: text('url').notNull(),
  is_enabled: integer('is_enabled').notNull().default(1),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
```

- [ ] **Step 3: Export it from `schema/index.ts`** — add `import { socialLinks } from './social-links.js';` and include `socialLinks` in the `export { ... }` block.

- [ ] **Step 4: Add the table to `ALL_TABLES_SQL` in `tests/helpers.ts`**

```sql
CREATE TABLE social_links (id TEXT PRIMARY KEY, platform TEXT NOT NULL UNIQUE, url TEXT NOT NULL, is_enabled INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
```

- [ ] **Step 5: Generate the Drizzle migration**

Run: `cd /home/kilian/code/soli-isle/backend && npm run db:generate`
Expected: a new file in `backend/drizzle/` creating `social_links`.

- [ ] **Step 6: Commit** `feat(backend): add social_links schema and migration`.

### Task 4.2: Public + admin social-link routes (TDD)

**Files:**
- Create: `backend/src/routes/public/social-links.ts`, `backend/src/routes/admin/social-links.ts`
- Modify: `backend/src/app.ts`, `backend/tests/helpers.ts`
- Test: `backend/tests/admin/social-links.test.ts`, `backend/tests/public/social-links.test.ts`

- [ ] **Step 1: Write the failing admin test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, loginAsAdmin } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance; let cookie: string;
beforeAll(async () => { app = await createTestApp(); cookie = await loginAsAdmin(app); });
afterAll(async () => { await app.close(); });

describe('admin social-links', () => {
  it('rejects unknown platform with 400', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/admin/social-links/myspace', headers: { cookie }, payload: { url: 'x', is_enabled: 1, sort_order: 0 } });
    expect(res.statusCode).toBe(400);
  });
  it('upserts a platform', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/admin/social-links/github', headers: { cookie }, payload: { url: 'https://github.com/me', is_enabled: 1, sort_order: 1 } });
    expect(res.statusCode).toBe(200);
    const list = await app.inject({ method: 'GET', url: '/api/admin/social-links', headers: { cookie } });
    expect(list.json().find((r: any) => r.platform === 'github').url).toBe('https://github.com/me');
  });
  it('updates the same platform without duplicating', async () => {
    await app.inject({ method: 'PUT', url: '/api/admin/social-links/github', headers: { cookie }, payload: { url: 'https://github.com/you', is_enabled: 0, sort_order: 2 } });
    const list = await app.inject({ method: 'GET', url: '/api/admin/social-links', headers: { cookie } });
    const rows = list.json().filter((r: any) => r.platform === 'github');
    expect(rows.length).toBe(1);
    expect(rows[0].is_enabled).toBe(0);
  });
  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/social-links' });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Write the failing public test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, loginAsAdmin } from '../helpers.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => {
  app = await createTestApp();
  const cookie = await loginAsAdmin(app);
  await app.inject({ method: 'PUT', url: '/api/admin/social-links/github', headers: { cookie }, payload: { url: 'https://github.com/me', is_enabled: 1, sort_order: 2 } });
  await app.inject({ method: 'PUT', url: '/api/admin/social-links/rss', headers: { cookie }, payload: { url: '/rss.xml', is_enabled: 0, sort_order: 1 } });
});
afterAll(async () => { await app.close(); });

describe('GET /api/social-links', () => {
  it('returns only enabled links ordered by sort_order', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/social-links' });
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.map((d: any) => d.platform)).toEqual(['github']);
  });
});
```

- [ ] **Step 3: Run to verify both fail**

Run: `cd /home/kilian/code/soli-isle/backend && npx vitest run tests/admin/social-links.test.ts tests/public/social-links.test.ts`
Expected: FAIL (routes not registered).

- [ ] **Step 4: Implement `routes/public/social-links.ts`**

```ts
import { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { socialLinks } from '../../db/schema/index.js';

export const publicSocialLinkRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/social-links', async () => {
    return app.db.select().from(socialLinks).where(eq(socialLinks.is_enabled, 1)).orderBy(socialLinks.sort_order);
  });
};
```

- [ ] **Step 5: Implement `routes/admin/social-links.ts`**

```ts
import { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { socialLinks } from '../../db/schema/index.js';
import { isSocialPlatform } from '../../lib/social-catalog.js';

export const adminSocialLinkRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/social-links', async () => {
    return app.db.select().from(socialLinks).orderBy(socialLinks.sort_order);
  });

  app.put('/api/admin/social-links/:platform', async (request, reply) => {
    const { platform } = request.params as { platform: string };
    if (!isSocialPlatform(platform)) return reply.status(400).send({ error: 'Unknown platform' });
    const body = request.body as { url: string; is_enabled?: number; sort_order?: number };
    const db = app.db; const now = new Date().toISOString();
    const existing = await db.select().from(socialLinks).where(eq(socialLinks.platform, platform)).limit(1);
    if (existing.length > 0) {
      await db.update(socialLinks).set({
        url: body.url, is_enabled: body.is_enabled ?? existing[0]!.is_enabled,
        sort_order: body.sort_order ?? existing[0]!.sort_order, updated_at: now,
      }).where(eq(socialLinks.platform, platform));
    } else {
      await db.insert(socialLinks).values({
        id: crypto.randomUUID(), platform, url: body.url,
        is_enabled: body.is_enabled ?? 1, sort_order: body.sort_order ?? 0,
        created_at: now, updated_at: now,
      });
    }
    return { ok: true };
  });
};
```

- [ ] **Step 6: Register routes** in both `backend/src/app.ts` and `backend/tests/helpers.ts`: import `publicSocialLinkRoutes` and `adminSocialLinkRoutes` and add `await app.register(adminSocialLinkRoutes);` / `await app.register(publicSocialLinkRoutes);` alongside the others.

- [ ] **Step 7: Run to verify both pass**

Run: `cd /home/kilian/code/soli-isle/backend && npx vitest run tests/admin/social-links.test.ts tests/public/social-links.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit** `feat(backend): social-links public and admin routes`.

### Task 4.3: Seed a couple of social links (optional defaults)

**Files:** `backend/src/db/seed.ts`.

- [ ] **Step 1:** Import `socialLinks`, insert a disabled-by-default sample row or two (e.g. `github`, `rss`) so the admin page shows real rows after a fresh seed. Use `is_enabled: 0` to avoid surprising the footer.
- [ ] **Step 2:** Run `cd backend && npm run db:seed` against a scratch DB; confirm no errors. (If the existing seed guards against re-seeding, follow that pattern.)
- [ ] **Step 3: Commit** `chore(backend): seed sample social links`.

### Task 4.4: Frontend social catalog (icons) + API hooks

**Files:**
- Create: `frontend/src/lib/social-catalog.tsx`, `frontend/src/api/social-links.ts`

- [ ] **Step 1: Create `social-catalog.tsx`** — the fixed catalog with platform id, label, and a 2-color inline SVG per platform:

```tsx
import type { ReactNode } from 'react';

export interface SocialMeta { platform: string; label: string; icon: ReactNode; urlHint: string; }

// Each icon: two-tone via currentColor + var(--color-accent). Implementer (frontend-design)
// supplies the real 24x24 SVG paths for each platform; structure shown for one:
export const SOCIAL_CATALOG: SocialMeta[] = [
  { platform: 'github', label: 'GitHub', urlHint: 'https://github.com/…', icon: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{/* github path */}</svg>) },
  { platform: 'twitter', label: 'X / Twitter', urlHint: 'https://x.com/…', icon: (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{/* x path */}</svg>) },
  { platform: 'tiktok', label: 'TikTok', urlHint: 'https://tiktok.com/@…', icon: (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{/* tiktok path */}</svg>) },
  { platform: 'telegram', label: 'Telegram', urlHint: 'https://t.me/…', icon: (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{/* telegram path */}</svg>) },
  { platform: 'instagram', label: 'Instagram', urlHint: 'https://instagram.com/…', icon: (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{/* instagram path */}</svg>) },
  { platform: 'facebook', label: 'Facebook', urlHint: 'https://facebook.com/…', icon: (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{/* facebook path */}</svg>) },
  { platform: 'reddit', label: 'Reddit', urlHint: 'https://reddit.com/u/…', icon: (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{/* reddit path */}</svg>) },
  { platform: 'email', label: 'Email', urlHint: 'mailto:you@example.com', icon: (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{/* mail path */}</svg>) },
  { platform: 'rss', label: 'RSS', urlHint: '/rss.xml', icon: (<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">{/* rss path */}</svg>) },
];

export const SOCIAL_META = Object.fromEntries(SOCIAL_CATALOG.map(s => [s.platform, s]));
```

- [ ] **Step 2: Create `api/social-links.ts`**

```ts
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
```

- [ ] **Step 3: Verify build** `cd frontend && npm run build`. **Commit** `feat(frontend): social catalog and api hooks`.

### Task 4.5: Admin Social Links page (TDD)

**Files:**
- Create: `frontend/src/pages/admin/SocialLinksPage.tsx`
- Modify: `frontend/src/App.tsx` (add route `admin/social-links`)
- Test: `frontend/tests/SocialLinksPage.test.tsx`

- [ ] **Step 1: Write the failing test** (mock the api module; assert each catalog platform renders a row with a toggle and URL input, and saving calls the mutation):

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const upsert = vi.fn();
vi.mock('../src/api/social-links.js', () => ({
  useAdminSocialLinks: () => ({ data: [{ id: '1', platform: 'github', url: 'https://github.com/me', is_enabled: 1, sort_order: 0 }], isLoading: false }),
  useUpsertSocialLink: () => ({ mutate: upsert, isPending: false }),
}));
import { SocialLinksPage } from '../src/pages/admin/SocialLinksPage.js';

describe('SocialLinksPage', () => {
  it('renders a row per catalog platform with the stored url prefilled', () => {
    render(<SocialLinksPage />);
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://github.com/me')).toBeInTheDocument();
    expect(screen.getByText('TikTok')).toBeInTheDocument(); // catalog platform with no stored row
  });
  it('saves a platform', () => {
    render(<SocialLinksPage />);
    fireEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);
    expect(upsert).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails.** `cd frontend && npx vitest run tests/SocialLinksPage.test.tsx` → FAIL.

- [ ] **Step 3: Implement `SocialLinksPage.tsx`** — merge `SOCIAL_CATALOG` with stored rows so every platform shows; per row: icon + label, enable toggle, URL input (placeholder = `urlHint`), sort_order number, Save button calling `useUpsertSocialLink`.

```tsx
import { useState } from 'react';
import { SOCIAL_CATALOG } from '../../lib/social-catalog.js';
import { useAdminSocialLinks, useUpsertSocialLink } from '../../api/social-links.js';

export function SocialLinksPage() {
  const { data, isLoading } = useAdminSocialLinks();
  const upsert = useUpsertSocialLink();
  const [draft, setDraft] = useState<Record<string, { url: string; is_enabled: number; sort_order: number }>>({});

  if (isLoading) return <div className="page-loading"><span className="skeleton" style={{height:'2rem',display:'block'}} /></div>;

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
```

- [ ] **Step 4: Add the route in `App.tsx`** — `import { SocialLinksPage } ...` and `<Route path="admin/social-links" element={<SocialLinksPage />} />` inside the admin `AdminLayout` block.

- [ ] **Step 5: Run to verify it passes.** `cd frontend && npx vitest run tests/SocialLinksPage.test.tsx` → PASS.

- [ ] **Step 6:** Add `.social-admin-row` styles to `admin.css` (frontend-design pass). Verify build.

- [ ] **Step 7: Commit** `feat(admin): social links manager page`.

### Task 4.6: Footer social rendering (TDD)

**Files:**
- Modify: `frontend/src/components/Footer.tsx`
- Modify: `frontend/src/styles/public.css`
- Test: `frontend/tests/Footer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/api/social-links.js', () => ({
  usePublicSocialLinks: () => ({ data: [
    { id: '1', platform: 'github', url: 'https://github.com/me', is_enabled: 1, sort_order: 0 },
    { id: '2', platform: 'email', url: 'mailto:me@x.com', is_enabled: 1, sort_order: 1 },
  ] }),
}));
import { Footer } from '../src/components/Footer.js';

describe('Footer social links', () => {
  it('renders an accessible link per enabled platform', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByLabelText('GitHub')).toHaveAttribute('href', 'https://github.com/me');
    expect(screen.getByLabelText('Email')).toHaveAttribute('href', 'mailto:me@x.com');
  });
});
```

- [ ] **Step 2: Run to verify it fails.** `cd frontend && npx vitest run tests/Footer.test.tsx` → FAIL.

- [ ] **Step 3: Update `Footer.tsx`** to render social links from `usePublicSocialLinks` using `SOCIAL_META` for icon + label:

```tsx
import { Link } from 'react-router';
import { usePublicSocialLinks } from '../api/social-links.js';
import { SOCIAL_META } from '../lib/social-catalog.js';

export function Footer() {
  const { data: socials } = usePublicSocialLinks();
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <strong>Soli Isle</strong>
        <p>An archipelago of essays, moments &amp; finds</p>
      </div>
      <nav className="site-footer__nav">
        <Link to="/articles">Articles</Link>
        <Link to="/moments">Moments</Link>
        <Link to="/resources">Resources</Link>
      </nav>
      {socials && socials.length > 0 && (
        <div className="site-footer__social">
          {socials.map(s => {
            const meta = SOCIAL_META[s.platform];
            if (!meta) return null;
            const external = s.platform !== 'email';
            return (
              <a key={s.id} href={s.url} aria-label={meta.label} className="social-icon"
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {meta.icon}
              </a>
            );
          })}
        </div>
      )}
    </footer>
  );
}
```

- [ ] **Step 4: Run to verify it passes.** `cd frontend && npx vitest run tests/Footer.test.tsx` → PASS.

- [ ] **Step 5:** Add `.site-footer__social` / `.social-icon` styles (2-tone, hover animation) to `public.css`. Verify build.

- [ ] **Step 6: Commit** `feat(frontend): render admin-managed social links in footer`.

---

## Final Verification

- [ ] **Frontend tests:** `cd /home/kilian/code/soli-isle/frontend && npm test` → all green.
- [ ] **Backend tests:** `cd /home/kilian/code/soli-isle/backend && npm test` → all green.
- [ ] **Production build:** `cd /home/kilian/code/soli-isle/frontend && npm run build` → PASS.
- [ ] **E2E smoke (Playwright):** public pages render in light + dark + mobile; article TOC works; admin loads, all flows work, social links round-trip from admin → footer.
- [ ] **Spec sweep:** confirm every spec section (§1–§11) has a corresponding implemented task.
- [ ] Use `superpowers:requesting-code-review` before merging, then `superpowers:finishing-a-development-branch`.

---

## Self-Review Notes (author)

- **Spec coverage:** §1 identity → Tasks 0.1–0.2, all Phase 2/3 frontend-design passes. §2 theme → 0.2–0.5. §3 public → 2.1–2.7. §4 admin → 3.1–3.6. §5 TOC → 2.4–2.5. §6 social links → Phase 4. §7 motion → 1.2 + per-task. §8 vocabulary → 1.1. §9 error/empty → 2.7 + 1.1. §10 CSS structure → 0.2. §11 testing → per-task TDD + Final Verification. All covered.
- **Ordering:** social links (§6) intentionally last per user instruction; Footer is built minimal in 2.1 then extended in 4.6.
- **Type consistency:** `useTheme`/`ThemeProvider`, `useToc`/`TocEntry`/`slugify`, `useScrollReveal`, `SOCIAL_CATALOG`/`SOCIAL_META`, `usePublicSocialLinks`/`useAdminSocialLinks`/`useUpsertSocialLink`, and route path `admin/social-links` are used consistently across tasks.
