# Frontend Redesign — Design Spec

**Date:** 2026-05-30
**Status:** Approved (design phase)

## Goal

Redesign the entire Soli Isle frontend. The current "Riso Archipelago" theme is
unwanted. Replace it with a **modern, formal, animated** interface that supports
**light and dark themes**, works well on **mobile and tablet**, and deliberately
avoids generic AI aesthetics (no Inter/Roboto/Arial/system fonts, no purple-on-white
gradients, no cookie-cutter layouts). The admin must be made **consistent with the
public pages** and its **functional bugs fixed**. The tech stack is unchanged.

Adds one new full-stack feature: **admin-managed social links** in the footer.

## Tech Stack (unchanged)

Vite + React 19 + React Router 7 + TanStack Query + TipTap on the frontend; Fastify
+ Drizzle + SQLite on the backend. Styling is vanilla CSS (no framework added). Fonts
are self-hosted via Fontsource. Tests use Vitest + Testing Library; manual/E2E
verification uses Playwright (`webapp-testing`).

## Strategy (Approach 1 — Fresh design system, full restyle)

Build a new semantic token system and rewrite the stylesheet around it. Add a thin
theme context. **React component logic stays untouched**; only classNames/markup
change where the new design requires. Public and admin share one design language.
Risk is contained to CSS + a small `ThemeProvider` + the new social-links feature.

## 1. Visual Identity — "Editorial Archive"

A quiet, confident personal journal: reading-first, generous whitespace, strong
typographic hierarchy, one restrained accent, subtle motion. Formal, considered —
closer to a literary magazine than a startup site. Drops riso/grain/hard-shadow
maximalism.

### Typography (all free, self-hosted via Fontsource, all non-generic)

| Role | Font |
|---|---|
| Display / headings / brand | **Fraunces** (serif, optical sizing) |
| UI / nav / labels / buttons / metadata | **Schibsted Grotesk** |
| Long-form article body | **Newsreader** (editorial serif) |
| Small metadata (slugs, timestamps, code) | **Space Mono** |

### Color tokens

Warm neutral foundation (never pure white/black). Single deep accent: **pine-teal**.

| Token | Light | Dark |
|---|---|---|
| bg | `#FAF8F3` | `#15140F` |
| surface | `#FFFFFF` | `#1E1C17` |
| text | `#1A1814` | `#ECE7DE` |
| muted | `#6B6358` | `#9A9286` |
| border | `#E7E1D6` | `#2A2722` |
| accent | `#14604A` | `#3FAE86` |

Additional derived tokens (accent-dim/hover, danger, focus ring, shadow) defined per
theme as needed.

## 2. Theme System

`ThemeContext` + `ThemeProvider`, mirroring the existing `LanguageContext` pattern.

- State: `'light' | 'dark'`.
- Resolution on first load: stored choice in `localStorage` (`soli-isle-theme`) →
  else `prefers-color-scheme` → else light.
- Applies via `data-theme="light|dark"` on `<html>`. Tokens live under
  `:root[data-theme="light"]` and `:root[data-theme="dark"]`; switching is one
  attribute flip.
- `setTheme` / `toggleTheme` persists to localStorage. A `matchMedia` listener
  updates the theme live **only while the user has not made an explicit choice**.
- An inline `<head>` script in `index.html` sets `data-theme` before React hydrates
  to prevent a flash of the wrong theme.

**Toggle UI:** small animated sun/moon control — in the public masthead next to the
language switcher, and in the admin sidebar/header. Whole-page color change uses a
short CSS transition on bg/text, disabled under `prefers-reduced-motion`.

**Admin unification:** admin stops hardcoding its own dark palette and consumes the
same tokens (so it themes light/dark too), with denser spacing and a utilitarian
layout.

## 3. Public Site

- **Masthead:** brand wordmark (Fraunces) left; centered nav (Home / Articles /
  Moments / Resources); language switcher + theme toggle right. Sticky; subtle
  border/blur appears on scroll. No decorative blobs/grain. On mobile, nav collapses
  into a hamburger → slide-in drawer.
- **Home:** quiet hero (site name + tagline) then a mixed reverse-chronological feed.
  Articles render as editorial cards (cover, category eyebrow, Fraunces title,
  excerpt, date); moments render inline as compact text entries, visually distinct so
  the feed has rhythm.
- **Articles list:** filterable (category/tag) grid of article cards; keeps existing
  infinite scroll.
- **Article detail:** centered single-column reading layout (~680px), Newsreader
  body, styled rich text (headings, quotes, images, links, code). Category/tags/date
  as a quiet header block. **Floating TOC** (see §5).
- **Moments:** clean vertical timeline. **Resources:** link cards with cover, title,
  description, category, external-link affordance. **Pages:** same reading layout as
  articles, **no TOC**.
- **Footer:** brand, tagline, nav repeat, theme/lang, and **social links** (see §6).

### Responsive

Mobile-first; breakpoints ~`640px` / `1024px`. Single-column feed/lists on mobile;
reading width and margins adapt; tap targets ≥44px; fluid type scale.

## 4. Admin

- Sidebar (brand; grouped nav: **Content** / **Taxonomy** / **System**; theme toggle;
  logout) + content area, themed via shared tokens. Sidebar collapses to a top bar +
  drawer on mobile.
- **List pages:** real data tables with column headers, status badges
  (Draft/Published), right-aligned row actions, delete confirmation. **Tables reflow
  into stacked cards on small screens.**
- **Editor pages:** focused two-column layout — main content (title, body, excerpt)
  left; metadata sidebar (slug, category, tags, cover, draft toggle, save) right.
  Translation tabs above content. Styled TipTap toolbar. Columns stack on mobile
  (metadata below content).

### Admin bug-fix approach

The React logic read as mostly sound, so bugs are not guessed at. During
implementation, run the app and exercise the admin end-to-end with Playwright
(`webapp-testing`): every manager and editor — create, edit, delete, translation
tabs, media upload, save/validation — plus the new social-links page. Each reproduced
bug is fixed and covered by a test. Verify first:

- Media upload flow.
- Slug-uniqueness / validation error surfacing.
- Admin queries inadvertently sending `?lang=`: `api/client.ts` always appends the
  stored language param, which could filter admin data — confirm admin GETs return
  all translations regardless of stored language.

## 5. Floating Table of Contents (articles only)

- Built from the article's `h2`/`h3` headings. Heading slug `id`s are added when
  rendering rich content (`RichContent`).
- **Desktop:** sticky floating TOC in the right margin; active-section highlighting
  via IntersectionObserver; smooth scroll on click.
- **Tablet/mobile:** collapsed into a compact "Contents" button that opens a
  dropdown/drawer; closes on selection.
- Hidden entirely when the article has fewer than ~2 headings.
- Custom pages do **not** get a TOC.

## 6. Admin-Managed Social Links (new full-stack feature)

A **fixed catalog** of supported platforms baked into code (each needs a hand-made
2-color icon): GitHub, X/Twitter, TikTok, Telegram, Instagram, Facebook, Reddit,
Email, RSS. The admin configures catalog entries; it does not invent platforms.

### Backend (follows existing route/Drizzle conventions)

- Table `social_links`: `id`, `platform` (one of the catalog values, unique), `url`,
  `is_enabled` (integer bool), `sort_order` (integer), `created_at`, `updated_at`.
  Not translatable.
- `GET /api/social-links` → enabled links, ordered by `sort_order` (public).
- Admin CRUD under `/api/admin/social-links` (session-protected like the rest).
- Drizzle migration + seed.

### Admin page — "Social Links" (System nav group)

- One row per catalog platform: icon, **enable/disable toggle**, **editable URL
  field** (Email is a `mailto:`, RSS is the feed path), and **reordering**
  (`sort_order`).
- Disabled or URL-less platforms do not render in the footer.

### Footer rendering

- Fetches enabled links via TanStack Query; renders each platform's inline 2-color
  SVG icon (themeable via `currentColor` + accent, accessible `aria-label`, hover
  animation). Order follows `sort_order`.

## 7. Motion

CSS-first, all gated by `prefers-reduced-motion`:

- Scroll-reveal fade/rise on cards (IntersectionObserver via a small shared hook).
- Hover: card lift, animated link underlines, button press feedback.
- Page transitions via the View Transitions API (graceful no-op where unsupported).
- Animated theme/language toggles. Springy but quick (~200–420ms), never flashy.

## 8. Shared Component Vocabulary

CSS classes (not a React refactor): card, eyebrow/meta label, button
(primary/ghost/danger), form field, tag/chip, tabs, empty state, toast/inline error.
Both public and admin draw from this vocabulary so they feel like one product.

## 9. Error & Empty States

Consistent inline form errors, a small toast for mutations, skeleton/loading states
replacing bare "Loading…", styled empty states ("No articles yet"), and a retry
affordance on network errors.

## 10. Code Structure

Replace the single 2,052-line `index.css` with imported files (logic untouched):

- `tokens.css` — light/dark custom properties.
- `base.css` — reset, typography, font faces.
- `components.css` — shared class vocabulary.
- `public.css` — public-site layouts.
- `admin.css` — admin layouts.
- `motion.css` — animations + reduced-motion guards.

Imported via `index.css`.

## 11. Testing & Verification

- Keep Vitest + Testing Library. Update component tests for changed markup.
- Add tests: `ThemeProvider` (resolution order, persistence, toggle), the TOC builder,
  the social-links admin page, and footer social rendering.
- Backend: tests for social-links routes, mirroring existing route tests.
- Playwright pass over the admin to confirm bug fixes.
- Production build (`tsc && vite build`) must pass.

## Out of Scope

- No new frontend framework or CSS framework.
- No changes to the existing content model beyond adding `social_links`.
- No unrelated refactoring of working backend logic.
