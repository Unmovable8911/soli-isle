# app-admin

- **Parent**: app
- **Purpose**: Renders the Author's console under `/admin` — dashboard, Article editor, Post composer, Asset library, Category and Tag screens — plus the `/admin/login` and `/admin/logout` endpoints that guard it.
- **Key Files**:
  - `src/app/admin/(console)/layout.tsx` (session gate, console top bar)
  - `src/app/admin/(console)/page.tsx` (dashboard of Articles and Posts)
  - `src/app/admin/(console)/articles/[articleId]/page.tsx` (Article editor screen)
  - `src/app/admin/(console)/posts/[postId]/page.tsx` (Post composer screen)
  - `src/app/admin/(console)/assets/page.tsx` (Asset library screen)
  - `src/app/admin/(console)/categories/page.tsx` (Category tree screen)
  - `src/app/admin/(console)/tags/page.tsx` (Tag manager screen)
  - `src/app/admin/admin-document.tsx` (console document shell)
  - `src/app/admin/login/page.tsx` (Author sign-in form)
  - `src/app/admin/login/submit/route.ts` (credential POST endpoint)
  - `src/app/admin/logout/route.ts` (session teardown endpoint)
  - `src/app/admin/shell.css` (top bar and page-head styles)
- **Dependencies**: app, components, components-admin, config, domain, http, messages, server, services
- **Dependents**: none
- **Exposes**: Nothing importable — a leaf module. Its surface is URLs: `/admin` (dashboard), `/admin/articles` and `/admin/articles/:articleId`, `/admin/posts` and `/admin/posts/:postId`, `/admin/assets`, `/admin/categories`, `/admin/tags`, plus `POST /admin/login/submit` and `POST /admin/logout`.

## Data Flow
1. `(console)/layout.tsx` reads the `soli-session` cookie and calls `verifyAuthorSession(getAppContext().auth, cookie)`; a missing or invalid session redirects to `/admin/login`.
2. The page negotiates a Locale from the `accept-language` header and the `soli-locale` cookie (`negotiateLocale`), then takes its labels from `messages[locale]`.
3. Server components read through the services (`listArticles(context.articles)`, `listPosts(context.posts)`, `getArticle`) and hand plain data to the `@/components/admin/*` client components.
4. Edits never travel back through the page: those client components POST/PATCH/DELETE to `/api/admin/*` (app-api), which forwards to `src/http/*`.
5. `login/submit` and `logout` are the in-module exception — they call `loginResponse` / `logoutResponse` from `src/http/admin-auth` directly.

## Internal Structure
- `(console)/` is a route group whose `layout.tsx` owns the authenticated chrome, so no page beneath it repeats the session check; `login/` has its own unauthenticated `layout.tsx` and renders bare.
- `admin-document.tsx` is the console's only `<html>`/`<body>`; both layouts wrap in it, and it imports `../globals.css`, which in turn `@import`s the five `admin/*.css` files.
- Pages stay thin: data in from `services`, markup out of `components-admin`; the CSS files here style list, editor, composer, dashboard and shell only.
- Every page and route declares `export const dynamic = "force-dynamic"` and `export const runtime = "nodejs"` — SQLite forbids static rendering.
