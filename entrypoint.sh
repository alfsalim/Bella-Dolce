#!/bin/sh
set -e

echo ">> [1/2] Running database migrations..."
npx prisma migrate deploy
echo ">> [1/2] Migrations done"

echo ">> [2/2] Starting server..."
exec node dist/server.js