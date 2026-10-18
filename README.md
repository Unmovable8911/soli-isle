# Soli Isle

A self-hosted, single-author, multilingual blog for long-form Articles and short Posts.

## Run the site

```sh
docker compose up --build
```

The application listens on plain HTTP at `http://localhost:3000`. It publishes only on host loopback by default so an outer reverse proxy remains the trusted boundary for forwarded headers. Set `APP_HOST` and `APP_PORT` to change the published address and port.

Persistent state lives under the host's `data/` directory:

- `data/database/` contains the SQLite database.
- `data/images/` contains uploaded image resources.

Backing up the site means copying that one `data/` directory.

## Health

`GET /api/health` checks the live SQLite connection and verifies that the image directory can be written, read, and cleaned up. It returns `200` when both checks pass and `503` otherwise.

## Local development

Node.js 24 is required.

```sh
npm install
npm run dev
```

Both `npm run dev` and `npm start` apply pending database migrations before the server starts. The same command is available directly as `npm run db:migrate`.

### Demo content

```sh
npm run seed:demo                      # placeholder images, drawn by sharp
npm run seed:demo -- --images ~/pics   # the Author's own pictures instead
```

The seed is local only: it replaces every Article, Post, Category, Tag and
uploaded image in the database it points at, so it refuses to run with
`NODE_ENV=production`. Re-running it produces the same site rather than a
doubled one. Images go through the real upload pipeline, so the display and
thumb variants are generated the way a real upload generates them.

## Checks

```sh
npm run lint
npm run typecheck
npm test
```

The shared Vitest harness creates an in-memory SQLite database with migrations applied, a fixed clock, and a temporary resource directory.

## Configuration

Copy `.env.example` when running outside Docker. The site's supported Locale list and timezone are defined once in `src/config/site.ts`.
