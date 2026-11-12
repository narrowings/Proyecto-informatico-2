# @red/ui — Sistema de diseño T-02

Componentes y estilos compartidos del Sprint 1. Conservan la paleta, tipografías
y API de los controles existentes en las ramas HU-001, HU-022 y HU-002.
La referencia visual compartida es el [diseño del proyecto en Claude](https://claude.ai/artifact/WsjWcK81ha5sPkkUvxJJq6#page-dcb81aee8d83).
Para esta implementación se priorizaron los elementos ya presentes en el código.

## Integración

Agregar `@red/ui: workspace:*` a las dependencias de Next.js y `@red/ui` a
`transpilePackages`. Desde el CSS global de `apps/web/app`, importar los estilos.

```css
@import 'tailwindcss';
@import '@red/ui/styles.css';
@source '../../../packages/ui/src';
```

La aplicación carga las fuentes locales DM Sans Variable y Bricolage Grotesque
Variable mediante Fontsource. Los componentes se importan desde `@red/ui`.

```tsx
import { Button, Field } from '@red/ui';

<Field label="Nombre" name="name" autoComplete="name" required />;
<Button type="submit">Guardar</Button>;
```

Al integrar las ramas frontend, reemplazar los imports de `@/components/ui/...`
por `@red/ui` y los tokens locales por estos estilos. Mantener los eventos y
validaciones propios de cada formulario. Se aceptan atributos nativos y `ref`
de React 19, compatible con el registro de campos de React Hook Form.

## Componentes y estados

| Componente                    | Propiedades específicas                              | Estados                                         |
| ----------------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| `Button`, `ButtonLink`        | `variant="primary"` o `"secondary"`                  | Normal, hover, foco, deshabilitado              |
| `Field`, `Select`, `Textarea` | `label`, `hint`, `error`                             | Vacío, completado, foco, error, deshabilitado   |
| `Checkbox`                    | `label`, `error`                                     | Marcado, desmarcado, foco, error, deshabilitado |
| `Alert`                       | `tone="info"`, `"warning"`, `"success"` o `"danger"` | Mensaje contextual                              |

`Button` usa `type="button"` por defecto. Indicar `type="submit"` para enviar.
`aria-disabled` mantiene el control enfocable y bloquea su activación;
`disabled` aplica el comportamiento nativo. El consumidor define `role="alert"`
o `role="status"` para anuncios dinámicos según corresponda.

Se reutilizan los controles nativos existentes. Radix UI / shadcn/ui quedan como
la opción prevista en el documento tecnológico para componentes compuestos
cuando una historia los requiera.

## Especificación visual para Figma

`src/styles.css` define los valores para las variables y estilos del equipo.

| Uso                | Token o valor                                                          |
| ------------------ | ---------------------------------------------------------------------- |
| Acción principal   | `brand` #0b6b53, hover `brand-dark` #0a4f3d                            |
| Fondo y texto      | `canvas` #f2f5f3, `ink` #10241f, `muted` #4f625c                       |
| Bordes             | `line` #dce5e1 para separación, `control-border` #7b8b83 para campos   |
| Error              | `danger` #b42318 sobre blanco o `danger-soft` #feeceb                  |
| Fuentes            | DM Sans Variable para texto, Bricolage Grotesque Variable para títulos |
| Texto de controles | 15 px, botones 16 px en negrita, etiquetas y ayudas 13 px              |
| Espaciado          | Escala de Tailwind de 4 px, con medios pasos existentes de 2 px        |
| Radios             | Campo 14 px, control 16 px, tarjeta 24 px                              |
| Tamaños            | Campos 48 px, botón mínimo 52 px, casilla con área mínima de 44 px     |
| Foco               | Contorno verde de 3 px con separación de 1 o 2 px                      |

En Figma, crear componentes con los estados de la tabla y Auto Layout. Comprobar
pantallas a 375 y 1440 px. El alcance incluye registro y consentimientos,
confirmación, inicio de sesión, selección de intención y perfiles de trabajador
y publicador. La lógica de esas pantallas pertenece a sus historias.
El archivo editable de Figma requiere acceso al espacio del equipo y queda
pendiente de vincular aquí.

## Verificación

```bash
pnpm --filter @red/ui lint
pnpm --filter @red/ui typecheck
pnpm --filter @red/ui test
pnpm --filter @red/web build
```

Las pruebas verifican etiquetas y errores asociados, atributos ARIA, envío de
formularios y refs, bloqueo de activación y reglas estructurales de axe-core.
Completar en cada pantalla integrada la revisión de contraste, teclado, foco,
zoom y lector de pantalla.

La verificación de los componentes en navegador a 375 y 1440 px pasó sin
infracciones detectadas por axe-core para WCAG 2 A/AA y 2.1 AA, incluyendo
contraste. Se comprobó foco de 3 px y ausencia de desbordamiento horizontal.
Esto cubre los componentes compartidos; cada historia debe verificar su pantalla
completa cuando los integre.
