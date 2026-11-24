# Órdenes para Codex · Frontend (campana, reportes y panel de administración)

Dos órdenes independientes, **una rama y un PR cada una**. Se hacen en este orden: primero la A y,
cuando esté fusionada, la B (la B reutiliza piezas de la A).

**No tocar lo que ya tiene dueño en el equipo:** `/publicar`, el feed `/trabajar`, el detalle de
oportunidad, `Mi actividad` (postulaciones, publicaciones, selecciones, trabajos), y los archivos
`lib/api/opportunities*.ts`, `lib/opportunities/**`, `lib/catalogs/use-catalogs.ts`,
`lib/dates.ts`, `lib/format.ts`. Si algo de eso te hace falta, **repórtalo**, no lo crees.

---

## Reglas comunes (las dos órdenes)

Monorepo pnpm. Frontend en `apps/web`: Next.js 15 (App Router), React 19, Tailwind 4,
react-hook-form + zod, pruebas con Vitest + Testing Library. **Identificadores en inglés; textos de
pantalla, comentarios y nombres de pruebas en español de Colombia**, como el resto del repo.

**No hagas commit ni push.** No toques `.env`, secretos ni `apps/api` (backend). Si el backend no
devuelve algo que necesitas, repórtalo.

### Lee primero (patrones a copiar, no a reescribir)

1. `apps/web/lib/api/http.ts`: `request`, `authenticated`, `postJson`, `ApiError` (problem `{ code,
message, errors }`).
2. Un cliente completo y su prueba: `lib/api/ratings.ts`, `ratings.http.ts`, `ratings.http.test.ts`;
   cómo se exporta en `lib/api/index.ts`.
3. Pantallas y componentes: `components/ratings/my-reputation.tsx` (+ test),
   `components/app/app-nav.tsx`, `components/app/require-profile.tsx`, `app/(app)/layout.tsx`,
   `lib/session/use-current-user.ts`, `lib/routes.ts`, `components/ui/*` (Button, Field, Select,
   Textarea, Alert, Checkbox: úsalos, no crees otros).
4. **Contrato de la API (fuente de verdad):** los controladores y DTO de `apps/api/src` que indique
   cada orden. Lee los DTO para saber nombres de campos, límites y códigos de error exactos.

### Calidad mínima de cada pantalla

- Estados completos: cargando, vacío, error (con "Reintentar") y éxito.
- Errores de la API: `400` muestra `errors` por campo; `401` lo maneja la sesión (ya existe);
  `403`, `404`, `409` y `429` con mensaje claro según `problem.code`.
- Accesible: botones con texto, `aria-live` para mensajes, foco visible, objetivos táctiles ≥ 44 px,
  formularios con `label`. Móvil primero (el layout ya es `max-w-md`).
- Nunca mostrar ids internos al usuario.
- Pruebas: cada cliente HTTP (`*.http.test.ts`, mockeando `fetch`) y cada componente con lógica
  (`*.test.tsx`), incluidos los errores.

### Verificación antes de entregar

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Todo en verde. Entrega **solo**: archivos creados/modificados, pantallas y rutas nuevas, resultado de
los comandos (número de pruebas web) y dudas.

---

## Orden A · Campana de notificaciones y botón "Reportar"

```bash
git fetch origin && git switch -c feat/web-notificaciones-y-reportes origin/main && pnpm install --frozen-lockfile
```

### A1. Campana y bandeja (HU-014 CA5, RF-07-07)

Contrato: `apps/api/src/notifications/notifications.controller.ts` y su `.spec.ts`.

- `GET /v1/notifications?page=&pageSize=` → `{ items, total, unread, page, pageSize }`; cada ítem
  `{ id, type, title, body, link, read, createdAt }`.
- `GET /v1/notifications/unread-count` → `{ unread }`.
- `POST /v1/notifications/:id/read` → `{ id, link }`; `POST /v1/notifications/read-all` → `{ updated }`.

Qué construir:

- `lib/api/notifications.ts` + `.http.ts` + `.http.test.ts`, exportado en `lib/api/index.ts`.
- **Campana en el encabezado** de `app/(app)/layout.tsx` (a la derecha del logo) con el número de no
  leídas (máx. "9+"). Consulta `unread-count` al montar y cada 60 s **solo con la pestaña visible**
  (`document.visibilityState`). Sin sesión no consulta nada.
- **Pantalla `/notificaciones`** (agrega `ROUTES.notifications`): lista paginada ("Cargar más"), las no
  leídas resaltadas, fecha relativa ("hace 5 min") y botón "Marcar todas como leídas". Al tocar una:
  la marca como leída y navega a su `link` **solo si empieza por `/`** (ruta interna); si no, se queda.
- Después de leer, la campana se actualiza sin recargar la página.

### A2. Botón "Reportar" reutilizable (HU-019)

Contrato: `apps/api/src/reports/reports.controller.ts` y `reports.dto.ts`.

- `POST /v1/reports` con `{ targetType: 'OPPORTUNITY'|'USER', targetId, profileKind?: 'PUBLISHER'|'WORKER', reason: 'FRAUD'|'INAPPROPRIATE'|'SPAM'|'OTHER', description? }`.
- Para un **usuario** se envía el **id del perfil** que se está viendo y `profileKind`; para una
  publicación, su id y sin `profileKind`.
- Respuestas: `201 { id, message }`; `400` (`errors.description` si OTHER sin descripción de ≥ 10);
  `400 CANNOT_REPORT_SELF`; `404`; `409 ALREADY_REPORTED`; `429` (límite de 10 por minuto).

Qué construir:

- `lib/api/reports.ts` + `.http.ts` + test.
- `components/reports/report-button.tsx`: props `{ targetType, targetId, profileKind?, onReported? }`.
  Abre un diálogo accesible (foco atrapado, `Esc` cierra, vuelve el foco al botón) con los motivos:
  "Fraude o estafa", "Contenido inapropiado", "Spam", "Otro". Con "Otro", la descripción es
  obligatoria (10–1000 caracteres, con contador). Al enviar muestra el agradecimiento (CA1/CA2).
  `409 ALREADY_REPORTED` → "Ya reportaste este elemento" (CA4). `CANNOT_REPORT_SELF` → no se muestra
  el botón si es el propio perfil, y si llega, mensaje claro. Llama `onReported` tras el éxito.
- **Móntalo ahora** en los perfiles públicos que ya existen: `app/(app)/publicadores/[id]` y
  `app/(app)/trabajadores/[id]` (busca sus componentes en `components/profiles/*-public-profile.tsx`).
  No lo muestres si el perfil es del usuario actual.
- **No lo montes** en el detalle de oportunidad (esa pantalla es de otro compañero). Deja en tu
  entrega la línea exacta para usarlo: `<ReportButton targetType="OPPORTUNITY" targetId={id} onReported={…} />`;
  tras reportar, el detalle debe volver al feed (HU-019 CA1: la publicación deja de mostrarse).

---

## Orden B · Panel de administración (HU-012, HU-037, HU-038)

```bash
git fetch origin && git switch -c feat/web-panel-de-administracion origin/main && pnpm install --frozen-lockfile
```

Contrato:

- `apps/api/src/moderation/moderation.controller.ts`, `moderation.dto.ts`, `moderation.service.ts` (forma de la cola).
- `apps/api/src/catalogs/admin-categories.controller.ts` y `dto/category.dto.ts`.
- `apps/api/src/opportunities/labor-warning-rules.admin.ts` y `dto/labor-warning-rule.dto.ts`.
- `apps/api/src/audit/audit.controller.ts` y `dto/list-audit.query.ts`.
- `GET /v1/auth/me` incluye `isAdmin: boolean` (tipo `CurrentUser` en `lib/api/session.ts`).

Reglas del panel:

- Rutas bajo **`app/(admin)/admin/...`** con su propio `layout.tsx` (encabezado "Panel de
  administración", menú: Reportes · Usuarios · Categorías · Reglas laborales · Auditoría). Mismo
  ancho móvil, pero las tablas deben verse bien también en escritorio (`md:`).
- Guardia `RequireAdmin`: sin sesión → iniciar sesión; con sesión y `isAdmin` falso → pantalla
  "Esta sección es solo para administradores" (la API además responde `403 ADMIN_ONLY`; trátalo
  igual). El enlace "Administración" aparece en el menú del usuario **solo si `isAdmin`**.
- **Toda acción que cambia algo** abre una confirmación con un campo **"Motivo" obligatorio
  (10–500 caracteres)** cuando la API lo pide (moderación), y muestra el resultado. Errores `409`
  por `code`: `ALREADY_HIDDEN`, `NOT_HIDDEN`, `INVALID_ACCOUNT_STATE`, `CATEGORY_EXISTS`;
  `400 CANNOT_MODERATE_ADMIN` → "No puedes moderar una cuenta administradora".
- Clientes HTTP en `lib/api/admin.ts` + `admin.http.ts` + tests.

Pantallas:

1. **`/admin/reportes`** (HU-012 CA1): filtros estado (Pendientes por defecto, Atendidos,
   Descartados) y tipo (Publicaciones, Usuarios). Cada tarjeta: elemento reportado (título de la
   publicación, o nombre + correo + estado de la cuenta), nº de reportes, motivos con su conteo,
   primera y última fecha. Acciones: **Ver detalle** (`GET /admin/reports/:type/:id`: lista de
   motivos y descripciones, sin datos de quien reporta), **Ocultar publicación** / **Mostrar de
   nuevo**, **Bloquear usuario**, **Descartar reportes**. Paginación.
2. **`/admin/usuarios`** (HU-012 CA3): búsqueda por nombre o correo (con espera de 300 ms al
   escribir) y filtro por estado. Cada fila: nombre, correo, estado (insignia de color + texto), rol
   y fecha de registro. Acciones según estado: Activa → Suspender / Bloquear; Suspendida → Bloquear /
   Reactivar; Bloqueada → Reactivar. Nunca acciones sobre administradores.
3. **`/admin/categorias`** (HU-037): lista con activas primero, nº de oportunidades que la usan,
   crear (nombre 3–100, descripción ≤ 300), editar y activar/desactivar (texto aclaratorio: "Las
   publicaciones existentes conservan su categoría").
4. **`/admin/reglas-laborales`** (RF-03-05): las reglas fijas (`FULL_DAY`, `LONG_TERM`,
   `SUBORDINATION_TERMS`) con nombre legible, texto, activa/inactiva y sus parámetros editables:
   horas (1–24) para `FULL_DAY` y días (1–365) para `LONG_TERM` — conviértelos a `minMinutes` al
   enviar —, y lista de expresiones (1–50, de 2–60 caracteres) para `SUBORDINATION_TERMS`.
5. **`/admin/auditoria`** (HU-038 CA2): tabla de solo lectura con fecha y hora, acción (nombre
   legible en español para cada `AuditAction`), usuario (id abreviado), objetivo, motivo e IP;
   filtros por rango de fechas, tipo de evento y usuario (UUID). Paginación. **Sin** botones de
   editar ni borrar (CA3).

Pruebas mínimas: guardia (sin sesión, no admin, admin), cada formulario de motivo (vacío, corto,
válido), manejo de cada `code` de error listado, conversión horas/días ↔ minutos, y que el enlace del
menú solo aparece con `isAdmin`.
