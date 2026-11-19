# Pruebas E2E

Playwright + axe-core sobre QA. Responsable: Andrés Felipe González Ortegon.

La suite de HU-008 comprueba la comunicación de Next.js con NestJS y PostgreSQL.
Ejecuta 28 escenarios en Chromium a 1440 × 900 y 375 × 812, para un total de
56 casos. Los componentes y validaciones también conservan sus pruebas con Vitest.

## Ejecución local

Desde la raíz del repositorio, con Node.js 24 o superior, pnpm y Docker Desktop
encendido, ejecutar lo siguiente.

```bash
pnpm install --frozen-lockfile
pnpm --filter @red/e2e exec playwright install chromium
pnpm test:e2e
```

En Linux, instalar también las dependencias del navegador.

```bash
pnpm --filter @red/e2e exec playwright install --with-deps chromium
```

El comando crea un contenedor PostgreSQL temporal con un puerto libre, aplica las
migraciones y el seed existentes, compila la API y la web y arranca ambas en
puertos libres. Al finalizar detiene los procesos y elimina el contenedor con sus
datos. Las variables de conexión de esta ejecución se generan en memoria.

Cada caso prepara cuentas sintéticas confirmadas y sus consentimientos en la base
temporal. El inicio, renovación y cierre de sesión pasan por la API real. Los
perfiles y las imágenes se crean desde el formulario y se comprueban en la base.
Las consultas públicas también se verifican desde otro usuario con perfil de
trabajador y desde una sesión anónima.

Los contextos envían una IP sintética distinta detrás del proxy local configurado
por el ejecutor. Esto representa clientes independientes y permite mantener los
límites de peticiones de la API. Los casos de error 503 interceptan únicamente la
petición correspondiente para comprobar la recuperación del frontend.

Para ejecutar un grupo o ver el navegador, usar los filtros de Playwright.

```bash
pnpm test:e2e --project=desktop
pnpm test:e2e --grep CP-008
pnpm test:e2e --project=desktop --headed
pnpm --filter @red/e2e exec playwright show-report
```

## Trazabilidad

Los identificadores CP-008 corresponden al documento de casos de HU-002 y HU-008.
Las pruebas adicionales cubren la integración y la accesibilidad de T-02.

| Referencia                  | Archivo en `specs/`                | Comprobaciones                                                                                                                    |
| --------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| CP-008-01 / CA1             | `publisher-profile.spec.ts`        | Persona natural, imagen persistida, acceso a `/publicar`, recarga y nuevo inicio de sesión.                                       |
| CP-008-02 / CA2             | `publisher-profile.spec.ts`        | Empresa, NIT separado en la base, contacto, sector y logo persistidos.                                                            |
| CP-008-03 / CA3             | `publisher-public-profile.spec.ts` | Consulta del perfil de persona natural por un trabajador y un visitante.                                                          |
| CP-008-04 / CA3             | `publisher-public-profile.spec.ts` | Consulta de razón social, logo, sector y descripción.                                                                             |
| CP-008-05 / CA3             | `publisher-public-profile.spec.ts` | Datos privados protegidos en pantalla y lista explícita de campos públicos de la API.                                             |
| CP-008-06 / CA4, HU-022 CA3 | `publisher-profile.spec.ts`        | Redirección al formulario al intentar publicar sin perfil, incluso después de abandonarlo.                                        |
| HU-008 validación           | `publisher-validation.spec.ts`     | Campos obligatorios, NIT incorrecto, tipo y tamaño de imagen, archivo falsificado, reintento tras 503 y bloqueo durante el envío. |
| HU-008 duplicados           | `publisher-profile.spec.ts`        | NIT de otra empresa y dos formularios de la misma cuenta.                                                                         |
| HU-008 vista pública        | `publisher-public-profile.spec.ts` | Perfil ausente, identificador inválido, error de servicio e insignia acorde al estado registrado.                                 |
| HU-021 integración          | `publisher-profile.spec.ts`        | Credenciales incorrectas, rutas protegidas, logout y restauración simultánea de dos pestañas.                                     |
| T-02 / WCAG 2.1 AA          | `publisher-accessibility.spec.ts`  | axe-core en formulario, errores, confirmación y perfil público, teclado, foco y ausencia de desbordamiento.                       |

La verificación de identidad se prepara como dato de prueba en PostgreSQL para
comprobar su representación. La reputación inicial se comprueba con el estado
“Nuevo en la plataforma”. El destino `/publicar` conserva la pantalla prevista
para el Sprint 1.

## Resultados y revisión

Playwright genera el informe HTML en `tests/e2e/playwright-report/` y el resultado
JSON en `tests/e2e/test-results/results.json`. Los fallos adjuntan captura y traza.
Los análisis de accesibilidad adjuntan sus resultados JSON al informe. Estas
carpetas están excluidas de Git.

El job E2E de GitHub Actions ejecuta la suite y conserva sus informes como
artefactos. El resultado de ese job corresponde al entorno temporal de CI.

Para la aceptación en QA, ejecutar los pasos CP-008-01 a CP-008-06 sobre la versión
desplegada, con los dominios HTTPS reales y cuentas sintéticas, y registrar el
commit, fecha, resultado y evidencia en la matriz de trazabilidad del equipo. El
ejecutor local prepara sus fixtures en una base temporal. La revisión de QA debe
comprobar además cookies Secure, CORS y persistencia después del despliegue.

Completar la revisión manual con zoom, lector de pantalla y el comportamiento de
foco durante todo el recorrido. axe-core y las pruebas de teclado cubren las
comprobaciones automáticas de esta suite.
