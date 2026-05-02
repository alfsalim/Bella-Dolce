#!/bin/sh
set -e

echo ">> [1/3] Backing up database..."
if [ -f /app/data/dev.db ]; then
  cp /app/data/dev.db /app/data/dev.db.bak
  echo ">> [1/3] Backup saved to /app/data/dev.db.bak"
else
  echo ">> [1/3] No existing database found — fresh install, skipping backup"
fi

echo ">> [2/3] Running database schema sync..."
npx prisma db push --accept-data-loss
echo ">> [2/3] Schema sync done"

echo ">> [3/3] Starting server..."
exec ./node_modules/.bin/tsx ./server.ts