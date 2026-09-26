#!/bin/sh
set -e

echo "Running database migrations..."
node --import=tsx scripts/migrate-entrypoint.ts

echo "Starting Next.js application..."
exec node server.js
