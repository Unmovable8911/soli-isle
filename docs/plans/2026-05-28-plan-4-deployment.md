# Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the application into a single Docker container and configure the OpenResty reverse proxy to serve it.

**Architecture:** Single Dockerfile builds the frontend (Vite) and backend (TypeScript → Node.js) into one image. The container runs Fastify which serves the API routes and the Vite-built SPA as static files. SQLite database and uploaded media are stored on Docker volumes for persistence. The existing OpenResty reverse proxy on the host handles TLS termination and routes traffic to the container.

**Tech Stack:** Docker, Node.js 22, OpenResty (existing host install)

**Depends on:** Plans 1-3 (Database, Backend API, Frontend)

---

## File Structure

```
Dockerfile
.dockerignore
docker-compose.yml
scripts/
  start.sh                     # container entrypoint — run migrations, start server
openresty/
  soli-isle.conf               # OpenResty site config (for reference, not applied by us)
```

---

### Task 1: Create Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create .dockerignore**

```
node_modules/
frontend/node_modules/
frontend/dist/
backend/node_modules/
backend/data/
.git/
docs/
*.md
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM node:22-alpine AS backend-builder
WORKDIR /build/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npx tsc --noEmit

# Stage 3: Production image
FROM node:22-alpine
WORKDIR /app

# Copy backend
COPY --from=backend-builder /build/backend/node_modules ./node_modules
COPY --from=backend-builder /build/backend/package.json ./
COPY --from=backend-builder /build/backend/src ./src
COPY --from=backend-builder /build/backend/drizzle ./drizzle
COPY --from=backend-builder /build/backend/drizzle.config.ts ./
COPY --from=backend-builder /build/backend/tsconfig.json ./

# Copy frontend static build
COPY --from=frontend-builder /build/frontend/dist ./public

# Copy entrypoint
COPY scripts/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Create data directories
RUN mkdir -p /app/data /app/data/media

ENV NODE_ENV=production
ENV DB_PATH=/app/data/soli-isle.db
ENV MEDIA_DIR=/app/data/media
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["/app/start.sh"]
```

- [ ] **Step 3: Create start.sh**

Create `scripts/start.sh`:

```bash
#!/bin/sh
set -e

echo "Running database migrations..."
npx tsx src/db/migrate.ts

echo "Starting server..."
exec npx tsx src/index.ts
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore scripts/start.sh
git commit -m "feat: add multi-stage Dockerfile and container entrypoint"
```

---

### Task 2: Create docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  app:
    build: .
    container_name: soli-isle
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - soli-isle-data:/app/data
    environment:
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - SESSION_SECRET=${SESSION_SECRET}
      - PORT=3000
      - HOST=0.0.0.0
      - DB_PATH=/app/data/soli-isle.db
      - MEDIA_DIR=/app/data/media

volumes:
  soli-isle-data:
```

- [ ] **Step 2: Create .env.example for reference**

Create `.env.example`:

```
ADMIN_PASSWORD=change-me
SESSION_SECRET=generate-a-random-secret-here
```

- [ ] **Step 3: Add .env to .gitignore**

Create or update `.gitignore` at repo root:

```
.env
backend/data/
backend/node_modules/
frontend/node_modules/
frontend/dist/
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example .gitignore
git commit -m "feat: add docker-compose with persistent volume and env config"
```

---

### Task 3: OpenResty reverse proxy configuration

**Files:**
- Create: `openresty/soli-isle.conf`

This file is for reference — the user applies it manually to their existing OpenResty setup.

- [ ] **Step 1: Create OpenResty config reference**

Create `openresty/soli-isle.conf`:

```nginx
# soli-isle blog — reverse proxy config
# Place this in your OpenResty sites directory and reload.

server {
    listen 443 ssl;
    server_name your-blog-domain.com;

    # SSL certs managed by your existing OpenResty setup

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Media files served directly by Fastify at /media/*
    # No special config needed — the proxy above handles it.
}
```

- [ ] **Step 2: Commit**

```bash
git add openresty/soli-isle.conf
git commit -m "docs: add OpenResty reverse proxy reference config"
```

---

### Task 4: Build and smoke-test the container

- [ ] **Step 1: Build the Docker image**

Run: `docker build -t soli-isle .`
Expected: builds successfully through all 3 stages

- [ ] **Step 2: Start the container**

Run: `ADMIN_PASSWORD=test123 SESSION_SECRET=dev-secret docker compose up -d`
Expected: container starts, migrations run, server listens on port 3000

- [ ] **Step 3: Smoke test the API**

```bash
# Health check
curl http://localhost:3000/api/health

# Public endpoint (no seed data yet, should return empty)
curl http://localhost:3000/api/articles?lang=en

# Admin login
curl -X POST http://localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"test123"}'
```
Expected: health returns `{"status":"ok"}`, articles returns `{"data":[],"next_cursor":null}`, login returns `{"ok":true}`

- [ ] **Step 4: Seed the database inside the container**

Run: `docker compose exec app npx tsx src/db/seed.ts`
Expected: "Seed data inserted successfully."

- [ ] **Step 5: Verify seeded content via API**

```bash
curl http://localhost:3000/api/articles?lang=en
curl http://localhost:3000/api/articles/hello-world?lang=en
curl http://localhost:3000/api/languages
```
Expected: returns seeded articles, languages (en, zh)

- [ ] **Step 6: Verify SPA is served**

```bash
curl -s http://localhost:3000/ | head -20
```
Expected: returns `index.html` with `<div id="root">` and script tags

- [ ] **Step 7: Stop the container**

Run: `docker compose down`

- [ ] **Step 8: Commit (if any changes from debugging)**

```bash
git add -A && git diff --cached --stat
# Only commit if fixes were needed
```

---

## Plan Complete — Verification Checklist

- [ ] `docker build -t soli-isle .` succeeds
- [ ] `docker compose up -d` starts the container
- [ ] `curl http://localhost:3000/api/health` returns `{"status":"ok"}`
- [ ] `curl http://localhost:3000/` returns the SPA shell HTML
- [ ] `curl http://localhost:3000/api/articles?lang=en` returns seeded articles
- [ ] Admin login works via `/api/admin/login`
- [ ] SQLite database survives container restart (volume mount)
- [ ] Uploaded media persists across restarts
- [ ] OpenResty config is ready to apply to the host's existing setup
