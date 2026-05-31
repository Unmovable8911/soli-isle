#!/bin/sh
# Runs the backend (tsx watch) and frontend (vite) together in one container.
set -e

# Apply migrations before starting. Idempotent: sets up a fresh database and is
# a no-op when already migrated.
echo "==> Running database migrations..."
cd /app/backend
npm run db:migrate

echo "==> Starting backend (tsx watch) and frontend (vite)..."
cd /app/backend
npx tsx watch src/index.ts &
BACKEND_PID=$!

cd /app/frontend
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

# Stop both children cleanly when the container is asked to stop.
term() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  exit 0
}
trap term TERM INT

# Busybox sh lacks `wait -n`; poll instead. If either process dies, tear the
# other down so the container exits (and Compose can restart it).
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done

echo "==> A process exited; shutting down."
term
