#!/bin/sh
set -eu

echo "Applying database migrations..."
pnpm db:migrate

if [ "${SEED_ON_BOOT:-true}" = "true" ]; then
  echo "Seeding Acme Manufacturing..."
  pnpm db:seed
fi

exec "$@"
