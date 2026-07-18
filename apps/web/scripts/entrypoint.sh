#!/bin/sh
# Runs DB migrations (plain Node + pg, no tsx) then starts the standalone server.
set -e

echo "Running database migrations..."
node scripts/migrate.mjs

echo "Starting Next.js server..."
exec node server.js
