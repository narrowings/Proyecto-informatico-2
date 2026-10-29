# Red de Oportunidades Laborales — Cali

Monorepo del MVP (Proyecto Informático II, UAO): Next.js + NestJS sobre PostgreSQL.

## Estructura

```
apps/web          Next.js (frontend)
apps/api          NestJS (api y worker) + Prisma
packages/config   Configuración compartida de TypeScript
packages/contracts Contratos OpenAPI y cliente generado
packages/ui       Componentes del design system
services/reco     Recomendación (diferido)
infra/qa          Despliegue de QA (ADR-08)
tests/e2e         Playwright
tests/load        k6
docs/adr          Registro de decisiones de arquitectura
```

## Arranque local

Requisitos: Node.js 24, pnpm 10 (`npm i -g pnpm@10`) y Docker.

```bash
pnpm install
cp .env.example apps/api/.env
docker compose up -d          # PostgreSQL en :5432, Mailpit en http://localhost:8025
pnpm dev                      # web en :3000, api en :3001
curl http://localhost:3001/v1/health
```

## Cómo trabajamos

- `main` siempre desplegable; ramas cortas `feat/HU-001-registro`, `fix/...`.
- Pull request con al menos 1 aprobación y CI en verde; fusión por squash.
- Conventional Commits (`feat:`, `fix:`, `chore:`).
- Cada PR referencia su HU (`Closes #n`).
