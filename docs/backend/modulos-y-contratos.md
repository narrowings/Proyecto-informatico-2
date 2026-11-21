# Backend de los Sprints 2 y 3: módulos y contratos

Monolito modular en NestJS (Documento Tecnológico 2.3). **Cada módulo es dueño de sus tablas;
ningún módulo lee ni escribe las tablas de otro.** Para usar datos de otro módulo se llama a su
servicio a través del contrato publicado en `apps/api/src/<módulo>/<módulo>.contract.ts`.

## Módulos y responsables

| Módulo          | Tablas                                         | Historias                            | Responsable      |
| --------------- | ---------------------------------------------- | ------------------------------------ | ---------------- |
| `catalogs`      | `zones`, `categories`                          | T-03                                 | Juan José Baloco |
| `profiles`      | `worker_profiles`, `publisher_profiles`, fotos | HU-002, 008, 029, 030, 032           | Juan José Baloco |
| `opportunities` | `opportunities`, `labor_warning_rules`         | HU-003, 009, 010, 023, 024, 025, 026 | Juan José Baloco |
| `applications`  | `applications`                                 | HU-005, HU-024 CA2                   | Juan José Baloco |
| `engagements`   | `selections`, `jobs`                           | HU-006, HU-028, HU-013               | Juan José Baloco |
| `ratings`       | `ratings`, `reputation_summaries`              | HU-007, HU-046                       | Juan José Baloco |
| `identity`      | `users`, tokens, `password_reset_tokens`       | HU-018                               | Juan José Baloco |
| `notifications` | `notifications`                                | HU-014 mínimo, RF-07-06/07           | Juan José Baloco |

## Contratos

- `opportunities/opportunities.contract.ts`: `getForEngagement`, `markFilled`, `reopenIfFilled`.
- `applications/applications.contract.ts`: `getWithParties`, `listForOpportunity`, `setStatus`.
- `notifications/notifications.contract.ts`: token `NOTIFICATIONS` con `notify` y `notifyMany`.

Quien consume un contrato lo prueba con un doble (mock) de la interfaz. Quien lo implementa
agrega una prueba que verifique que su servicio cumple la interfaz (`satisfies` o `implements`).
Cambiar un contrato se acuerda en el PR de ambos módulos.

## Reglas comunes

- Prefijo `/v1`, `validationPipe` global (lista blanca), errores `{ code, message }` o
  `{ message, errors: { campo: [...] } }`, mensajes en español.
- Endpoints autenticados con `@UseGuards(AuthenticatedGuard)` y `@CurrentUser()`. Toda consulta
  por id verifica que el recurso pertenece a quien llama (sin IDOR): si no, 404.
- Inyección con `@Inject(Token)` explícito en constructores (Vitest no emite metadata de tipos).
- Respuestas públicas sin correo, teléfono ni dirección exacta (RF-02-07). La dirección exacta y
  el teléfono solo se muestran a las partes de una selección aceptada.
- Fechas en UTC en la base; el frontend las muestra en America/Bogota.
- Tareas programadas (24 h, 72 h, 7 días, vencimientos): con `pg-boss` sobre PostgreSQL
  (Documento Tecnológico, decisión que reemplaza Redis). Toda tarea es idempotente.
- Pruebas con Vitest junto al código (`*.spec.ts`): servicio con Prisma simulado y HTTP con
  `NestFactory` + `fetch`, como `session.controller.spec.ts`.
