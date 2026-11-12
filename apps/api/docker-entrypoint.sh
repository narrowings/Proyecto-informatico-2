#!/bin/sh
# Arranque de la API en contenedor: migraciones, datos semilla y servidor.
set -e

prisma() { node node_modules/prisma/build/index.js "$@"; }

prisma migrate deploy

# El seed solo corre si package.json lo define y RUN_SEED no es "false". Los seeds deben ser idempotentes (upsert).
if [ "${RUN_SEED:-true}" = "true" ] && node -e "process.exit(require('./package.json').prisma?.seed ? 0 : 1)"; then
  prisma db seed
fi

exec node dist/main.js
