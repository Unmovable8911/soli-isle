# Soli Isle

A personal, multilingual blog. It hosts long-form **articles**, short-form
**moments**, shared **resources** (external links), and standalone **pages**
(About, Contact, …). A single admin manages all content through a custom admin
interface; the public site is a client-side SPA served from a small API.

Everything is translatable: each content type has a parallel translation table, and
new languages are added by inserting rows in the admin — no code changes, no redeploy.

## Highlights

- **Editorial Archive** design — calm, reading-first, with a full **light/dark theme**
  (follows your OS by default, with a manual toggle that persists).
- Distinctive typography (Fraunces · Schibsted Grotesk · Newsreader · Space Mono),
  self-hosted, and a restrained pine-teal accent.
- Responsive across mobile, tablet, and desktop.
- Article pages get a **floating table of contents** with scroll-spy.
- Rich-text editing via TipTap, image uploads, and inline translation tabs in the editor.
- **Admin-managed social links** in the footer (GitHub, X, TikTok, Telegram,
  Instagram, Facebook, Reddit, Email, RSS) — enable/disable, edit, and reorder.
- Subtle, accessibility-aware motion (respects `prefers-reduced-motion`).

## Tech Stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Frontend   | Vite + React 19 + React Router 7 (SPA)              |
| Data/state | TanStack Query                                      |
| Rich text  | TipTap (ProseMirror)                                |
| Styling    | Vanilla CSS with a light/dark design-token system   |
| Backend    | Fastify (Node.js)                                   |
| Database   | SQLite                                              |
| ORM        | Drizzle                                             |
| Auth       | Fastify session cookie; admin password via env var  |

## Project Structure

```
soli-isle/
├── backend/          Fastify API + SQLite/Drizzle
│   ├── src/
│   │   ├── db/        schema, migrations runner, seed
│   │   ├── routes/    public/* and admin/* route plugins
│   │   └── app.ts     app factory (plugins, auth hook, route registration)
│   └── drizzle/       generated SQL migrations
├── frontend/         Vite + React SPA
│   └── src/
│       ├── pages/     public/* and admin/* pages
│       ├── components/, contexts/, hooks/, api/, lib/
│       └── styles/    tokens, base, components, public, admin, motion (CSS)
└── docs/             specs and implementation plans
```

## Prerequisites

- **Node.js 20+** and npm.

## Running Locally

The frontend dev server proxies `/api` and `/media` to the backend, so **run both**.
Use two terminals.

### 1. Backend — http://localhost:3000

```bash
cd backend
npm install                                   # first time only

export ADMIN_PASSWORD=admin                   # required
export SESSION_SECRET=dev-secret-must-be-32-chars-long!!

npm run db:migrate                            # create/upgrade the SQLite schema
npm run db:seed                               # FRESH database only (see note)
npx tsx src/index.ts                          # start the API
```

> **`db:seed` is for an empty database only.** It inserts seed rows unconditionally,
> so running it against an already-seeded `backend/data/soli-isle.db` will fail on
> duplicate keys. If you already have data, just run `db:migrate` and skip the seed.
> For a clean slate: `rm backend/data/soli-isle.db` then migrate + seed again.

### 2. Frontend — http://localhost:5173

```bash
cd frontend
npm install                                   # first time only
npm run dev
```

Then open **http://localhost:5173**.

### Admin

- Sign in at **http://localhost:5173/admin/login** with the `ADMIN_PASSWORD` you set.
- Social links are seeded **disabled** — enable and edit them under
  **Admin → System → Social Links** to make them appear in the footer.

## Environment Variables (backend)

| Variable         | Required | Default                              | Purpose                                  |
| ---------------- | -------- | ------------------------------------ | ---------------------------------------- |
| `ADMIN_PASSWORD` | yes      | —                                    | Admin login password                     |
| `SESSION_SECRET` | no       | `change-me-in-production-secret!!`   | Session cookie signing secret (set this in prod) |
| `PORT`           | no       | `3000`                               | API port                                 |
| `HOST`           | no       | `0.0.0.0`                            | API bind host                            |
| `DB_PATH`        | no       | `./data/soli-isle.db`                | SQLite file path                         |
| `MEDIA_DIR`      | no       | `./data/media`                       | Uploaded media directory                 |

## Database Tasks (backend)

```bash
npm run db:generate   # generate a new Drizzle migration from schema changes
npm run db:migrate    # apply pending migrations
npm run db:seed       # seed an empty database
```

## Testing

```bash
# Backend (Vitest)
cd backend && npm test

# Frontend (Vitest + Testing Library)
cd frontend && npm test
```

## Production Build

```bash
cd frontend && npm run build      # outputs static assets to frontend/dist
```

The intended deployment is a single Docker container behind a reverse proxy
(OpenResty), serving the built frontend and the Fastify API. See `docs/specs.md`
for the full architecture.
