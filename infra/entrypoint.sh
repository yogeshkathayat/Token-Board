#!/bin/sh
set -e

echo "Running database migrations..."
node --import tsx src/lib/db/migrate.ts

if [ $? -ne 0 ]; then
  echo "Migration failed"
  exit 1
fi

echo "Starting Next.js server..."
exec node server.js
