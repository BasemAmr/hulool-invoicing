#!/bin/sh
set -e

echo "Running database schema alignment (drizzle-kit push)..."
npx drizzle-kit push --force

echo "Starting Next.js application..."
exec node server.js
