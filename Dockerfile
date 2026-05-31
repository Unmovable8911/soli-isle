# Single dev image for Soli Isle: holds both backend and frontend dependencies.
# Application source is NOT copied in — it is bind-mounted at runtime (see compose.yaml)
# so code changes hot-reload without rebuilding.
FROM node:24-alpine

# Toolchain for compiling the native modules (better-sqlite3, bcrypt) from source.
# Alpine uses musl, so prebuilt binaries don't apply and these are built fresh.
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies into the image as cached layers (only re-runs when a
# package manifest changes). The compiled node_modules are kept at runtime via
# anonymous volumes in compose.yaml, shadowing the bind-mounted source.
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 3000 = Fastify API, 5173 = Vite dev server
EXPOSE 3000 5173

ENTRYPOINT ["docker-entrypoint.sh"]
