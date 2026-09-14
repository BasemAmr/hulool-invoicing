#!/bin/sh
set -e

echo "Running database migrations..."
npm run db:migrate || pnpm db:migrate || npx drizzle-kit migrate

echo "Starting Next.js application..."
exec node server.js
