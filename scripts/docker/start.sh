#!/bin/sh
# Production container start (Dockerfile "runner" stage): bring the database schema up to date, then
# start Next.js. Seeding never runs here.
set -e
PRISMA="node node_modules/prisma/build/index.js"

if ls prisma/migrations/*/migration.sql >/dev/null 2>&1; then
  echo "[start] Applying database migrations (prisma migrate deploy)"
  $PRISMA migrate deploy
else
  # No migration history in the image: create or update the tables straight from schema.prisma.
  # Without --accept-data-loss, Prisma refuses any change that would drop data and the container stops.
  echo "[start] No prisma/migrations folder in this image; syncing tables with 'prisma db push'."
  echo "[start] Commit prisma/migrations (made by 'npx prisma migrate dev') to get versioned upgrades."
  $PRISMA db push --skip-generate
fi

exec node server.js
