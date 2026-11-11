# Imagen de la API (NestJS + Prisma). Se construye desde la raíz del monorepo:
#   docker build -f apps/api/Dockerfile -t red-api .
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    TURBO_TELEMETRY_DISABLED=1
# Prisma necesita OpenSSL en tiempo de ejecución.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@red/api
# Copia solo la API con sus dependencias de producción (sin el resto del monorepo).
RUN pnpm --filter=@red/api deploy --prod --legacy /out \
    && rm -rf /out/dist && cp -r apps/api/dist /out/dist \
    && cd /out && node node_modules/prisma/build/index.js generate

FROM base AS runtime
LABEL red.project=red-oportunidades
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /out ./
COPY --chown=node:node apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/v1/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
