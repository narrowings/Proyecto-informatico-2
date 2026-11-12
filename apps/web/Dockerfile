# Imagen del frontend (Next.js en modo standalone). Se construye desde la raíz del monorepo:
#   docker build -f apps/web/Dockerfile -t red-web .
FROM node:24-bookworm-slim AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    TURBO_TELEMETRY_DISABLED=1 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo
COPY . .
# public/ es opcional en Next.js; se crea vacío para que el COPY de la imagen final no falle.
RUN mkdir -p apps/web/public
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@red/web

FROM node:24-bookworm-slim AS runtime
LABEL red.project=red-oportunidades
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000)).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "apps/web/server.js"]
