# Estado del proyecto y guía de traspaso

Actualizado: 24 de noviembre de 2026. Responsable del backend: Juan José Baloco (`juanbaloco`).
Este documento sirve para que cualquier persona (o asistente) continúe el trabajo sin contexto previo.

## 1. Cómo está organizado

- Monorepo pnpm + Turborepo: `apps/api` (NestJS 11 + Prisma 6 + PostgreSQL), `apps/web` (Next.js 15),
  `packages/ui`, `tests/e2e` (Playwright), `infra/qa` (despliegue de QA en el servidor Docker de
  William, ver `docs/adr/ADR-08-qa-en-servidor-propio.md`).
- El backend es un monolito modular: cada módulo es dueño de sus tablas y los demás lo usan por
  contratos (`*.contract.ts`). Reglas en `docs/backend/modulos-y-contratos.md`.
- `main` está protegido por CI (`verify`, `e2e`, `docker`). QA se actualiza desde `main`.
- Convenciones: identificadores en inglés; textos, comentarios y pruebas en español. Commits a
  nombre del autor humano. Ramas y PR con nombres descriptivos (nada de "bloque N").

## 2. Backend: terminado (todo en `main`)

| Área                               | Historias                              | Rutas principales (`/v1`)                                                                                    |
| ---------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Registro, confirmación, términos   | HU-001, HU-017                         | `auth/register`, `auth/confirm-email`, `auth/accept-terms`                                                   |
| Sesión                             | HU-021                                 | `auth/login`, `auth/refresh`, `auth/logout`, `auth/me` (incluye `isAdmin`)                                   |
| Recuperar contraseña               | HU-018                                 | `auth/forgot-password`, `auth/reset-password`                                                                |
| Perfiles                           | HU-002, HU-008, HU-029, HU-030, HU-032 | `profiles/worker/*`, `profiles/publisher/*`                                                                  |
| Catálogos                          | T-03, HU-016                           | `zones`, `categories`                                                                                        |
| Publicar y gestionar oportunidades | HU-025, HU-003, HU-024, HU-023         | `opportunities`, `opportunities/labor-warnings`, `opportunities/mine`, `…/pause                              | resume                                           | close          | cancel`                                        |
| Feed y detalle                     | HU-009, HU-010, HU-026                 | `GET opportunities?mode=tasks                                                                                | formal`, `GET opportunities/:id`                 |
| Postulaciones                      | HU-005, HU-024                         | `opportunities/:id/applications`, `applications/mine`, `applications/status`, `opportunities/:id/candidates` |
| Selección y trabajos               | HU-006, HU-028, HU-013                 | `opportunities/:id/applicants`, `…/selections`, `selections/mine`, `selections/:id/accept                    | reject`, `jobs`, `jobs/:id/finish                | confirm-finish | cancel`                                        |
| Calificaciones y reputación        | HU-007, HU-046                         | `jobs/:id/ratings`, `ratings/mine`                                                                           |
| Notificaciones (bandeja y correo)  | HU-014, RF-07-06/07                    | `notifications`, `notifications/unread-count`, `…/:id/read`, `…/read-all`                                    |
| Reportes                           | HU-019                                 | `POST reports`                                                                                               |
| Moderación                         | HU-012 CA1–CA3                         | `admin/reports`, `admin/opportunities/:id/hide                                                               | unhide`, `admin/users`, `admin/users/:id/suspend | block          | reactivate`, `admin/reports/:type/:id/dismiss` |
| Categorías y reglas laborales      | HU-037, RF-03-05                       | `admin/categories`, `admin/labor-warning-rules`                                                              |
| Auditoría                          | HU-038                                 | `admin/audit` (inalterable: la base rechaza UPDATE/DELETE/TRUNCATE)                                          |

Contrato exacto de cada ruta: el controlador y los DTO del módulo en `apps/api/src/<módulo>/`. La
guía para el equipo de frontend de los Sprints 2 y 3 está en Claude Docs ("Guía de integración
frontend · Sprints 2 y 3"); pedir el enlace a Juan José.

**Nombrar administradores** (no hay pantalla, a propósito):
`pnpm --filter @red/api admin:promote <correo> [--revoke]`. En QA:
`docker compose -p red-qa -f infra/qa/docker-compose.qa.yml exec api node scripts/promote-admin.mts <correo>`.

## 3. Backend: pendiente o fuera de alcance

- **HU-012 CA4** (cola de verificaciones) depende de **HU-020** (Fase 4): no iniciado.
- **HU-036** (soporte y apelaciones): no iniciado. Mientras tanto, los avisos de moderación indican
  escribir a `SUPPORT_EMAIL`.
- **HU-039** (métricas de administración): no iniciado.
- **Decisiones pendientes del PO:** HU-031 (derechos ARCO), HU-045, bloqueo tras 5 intentos fallidos
  de inicio de sesión.
- Mejora opcional: subir Vitest a la versión 4 (vulnerabilidades solo de desarrollo).
- Las cuentas bloqueadas reciben al iniciar sesión el mismo mensaje que las suspendidas
  (`ACCOUNT_SUSPENDED`). Cambiarlo es pequeño si el equipo lo pide.

## 4. Operación (QA)

- **Correo real con Gmail (T-04):** en curso con William. Variables en `/opt/red-qa/qa.env`:
  `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER`, `SMTP_PASS`
  (contraseña de aplicación de 16 letras, sin espacios), `MAIL_FROM` (misma cuenta) y `SUPPORT_EMAIL`.
  Las credenciales **nunca** van al repo.
- Si el correo falla, el log de la API solo muestra el código (`EAUTH`, `ETIMEDOUT`…), nunca el
  enlace ni el destinatario.

## 5. Frontend

Hecho en `main`: registro, confirmación, inicio de sesión, términos, recuperar contraseña,
intención, perfiles (crear, editar, públicos), calificar y reputación.

En curso por el equipo (no duplicar): **Publicar** (`feat/HU-025-003-publicar-oportunidad`).

Por hacer (orden sugerido): feed y detalle con postularse → Mi actividad (postulaciones y mis
publicaciones) → interesados y selección → aceptar/rechazar selección → trabajos → campana →
reportar → panel de administración.

Las órdenes para Codex de **campana, reportar y panel de administración** están en
`docs/frontend/ordenes-codex-frontend.md` (Orden A y Orden B).

## 6. Cómo continuar con Codex (flujo del equipo)

1. Juan José pega la orden en Codex (en su PC). Codex trabaja en una rama nueva **sin commit ni push**.
2. Juan José revisa `git status`, hace el commit a su nombre y sube la rama.
3. Quien revisa (asistente o persona): descarga la rama, mezcla `origin/main`, lee el diff, corrige,
   agrega pruebas que falten y verifica con
   `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
4. PR contra `main` con descripción de qué incluye y cómo se verificó; se fusiona cuando el CI
   (`verify`, `e2e`, `docker`) está en verde.

### Verificar el backend con una base real (local)

```bash
# PostgreSQL 16 local con usuario red/red y base red_oportunidades
export DATABASE_URL='postgresql://red:red@127.0.0.1:5432/red_oportunidades?schema=public'
pnpm --filter @red/api exec prisma migrate deploy
pnpm --filter @red/api build
NODE_ENV=development PORT=4011 JWT_SECRET=$(openssl rand -hex 32) WEB_URL=http://localhost:3000 \
  node apps/api/dist/main.js
```

Sin `SMTP_HOST` y con `NODE_ENV=development`, los enlaces de correo se escriben en el log.
