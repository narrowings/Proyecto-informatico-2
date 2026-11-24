# Orden C para Codex · Feed, detalle, postulación y vacante formal

Lee primero las **reglas comunes** de `docs/frontend/ordenes-codex-frontend.md` (stack, calidad,
verificación). Aplican igual aquí. **No hagas commit ni push.**

```bash
git fetch origin
git switch -c feat/web-feed-detalle-y-vacante-formal origin/main
pnpm install --frozen-lockfile
git status   # debe estar limpio
```

**Reutiliza lo que ya existe, no lo dupliques:** `lib/api/opportunities.ts` y `.http.ts` (cliente de
Rafael: agrégale métodos, no crees otro), `lib/catalogs/use-catalogs.ts`, `lib/dates.ts`,
`lib/format.ts` (pesos), `components/opportunities/*` (tipos y formulario de tarea),
`components/reports/report-button.tsx`, `components/activity/activity-ui.tsx` (etiquetas de tipo y
estado). **No toques** `components/activity/*`, `components/admin/*` ni `apps/api`.

Patrón obligatorio de clientes: los errores esperados se traducen a estados (`{ status: '…' }`), como
`lib/api/reports.http.ts`. En pruebas, los mocks **resuelven** estados; no rechaces promesas.

Trabaja por pasos; **cada paso con sus pruebas**, y valida al cerrarlo:
`pnpm --filter @red/web lint && pnpm --filter @red/web typecheck && pnpm --filter @red/web test`.
Si te quedas sin espacio, detente al cierre de un paso en verde y di cuáles quedaron hechos.

---

## Paso 1 · Feed en `/trabajar` (HU-009, HU-010, RF-04-06)

Contrato: `apps/api/src/opportunities/opportunities.controller.ts` (`GET /v1/opportunities`) y
`dto/list-opportunities.query.ts` (o el DTO de consulta que use el controlador).

- Reemplaza el "Próximamente" de `app/(app)/trabajar/page.tsx` (conserva `RequireProfile profile="worker"`).
- Dos pestañas: **Trabajos y tareas** (`mode=tasks`) y **Empleo formal** (`mode=formal`). Recuerda la
  pestaña elegida en la URL (`?modo=formal`).
- Búsqueda por texto (espera 300 ms) y filtros: zona y categoría (de `useCatalogs`); en tareas, pago
  mínimo y tipo; en formal, salario mínimo y modalidad. Botón "Limpiar filtros".
- Tarjetas: tipo, título, publicador (nombre y foto), zona, pago o rango salarial en pesos, fecha
  (tareas) o cierre (formal). Toda la tarjeta lleva a `/oportunidades/[id]`.
- Paginación con "Cargar más". Estados: cargando, vacío ("No hay oportunidades con estos filtros"),
  error con "Reintentar".
- Marca "Ya te postulaste" usando `GET /v1/applications/status?ids=…` (revisa el DTO exacto en
  `apps/api/src/applications/`).

## Paso 2 · Detalle `/oportunidades/[id]` y postulación (HU-026, HU-005)

Contrato: `GET /v1/opportunities/:id` y `POST /v1/opportunities/:id/applications`
(`apps/api/src/applications/dto/*`).

- Detalle público: todo lo que devuelve la API (nunca hay dirección exacta), con enlace al perfil
  público del publicador (`/publicadores/[id]`).
- **Tarea o trabajo rápido:** botón "Me interesa" (cuerpo `{}`). **Vacante formal:** "Postularme" con
  mensaje opcional (≤ 1000 caracteres, con contador).
- Estados: ya postulado (`409`, mostrar "Ya te postulaste"), oportunidad cerrada o vencida (`409`
  por `code`, deshabilitar con explicación), sin perfil de trabajador (`403`, llevar a crearlo),
  `404` ("Esta oportunidad ya no está disponible"), `429`.
- El dueño de la publicación no ve el botón de postularse; ve "Ver en Mi actividad".
- Monta `<ReportButton targetType="OPPORTUNITY" targetId={id} onReported={() => router.push('/trabajar')} />`
  (no para el dueño). Agrega `ROUTES.opportunity(id)` en `lib/routes.ts`.

## Paso 3 · Formulario de vacante formal (HU-024)

Contrato: `POST /v1/opportunities` con `type: 'FORMAL_JOB'`; campos y límites en
`apps/api/src/opportunities/dto/create-opportunity.dto.ts` (salario mínimo y máximo, modalidad,
horario, experiencia, requisitos, fecha de cierre, cupos, zona, categoría).

- Conéctalo donde `components/opportunities/publish-flow.tsx` hoy solo avisa para `FORMAL_JOB`.
  Sigue el estilo de `task-form.tsx` (zod + react-hook-form, errores por campo, errores del API).
- Validaciones: salario máximo ≥ mínimo; la fecha de cierre es futura (hora de Colombia, enviada en
  UTC con `lib/dates.ts`). Las vacantes formales **no** llevan advertencia laboral.
- Al publicar, la misma pantalla de éxito del flujo.

## Paso 4 · Verificación final

`pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` en la raíz, todo en
verde. Entrega: archivos, pantallas, número de pruebas web y dudas.
