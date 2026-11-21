// Datos semilla. Se ejecuta con `pnpm --filter @red/api prisma:seed` (Node 24 ejecuta TypeScript directamente).
import prismaClient from '@prisma/client';

const { PrismaClient } = prismaClient;
const prisma = new PrismaClient();

// Versiones provisionales de los textos legales (riesgo del plan del Sprint 1): se reemplazan por una
// versión nueva cuando llegue el texto aprobado por jurídica (Emmanuel Solarte), nunca se editan.
const legalDocuments = [
  { type: 'TERMS', version: '0.1', url: '/legal/terminos' },
  { type: 'PRIVACY_POLICY', version: '0.1', url: '/legal/privacidad' },
  { type: 'DATA_TREATMENT', version: '0.1', url: '/legal/tratamiento-de-datos' },
] as const;

// T-03: catálogo PROVISIONAL, igual al que ya usa el frontend. La lista oficial de la Fase 0 la
// entrega José Alejandro; al llegar se agregan las filas nuevas y las que sobren se desactivan
// (isActive = false), nunca se borran, porque perfiles y oportunidades guardan su id.
const zones = ['Norte', 'Sur', 'Oriente', 'Oeste', 'Centro', 'Ladera'];

const categories = [
  { name: 'Trasteos y logística', description: 'Cargue, descargue, mudanzas y mensajería' },
  { name: 'Eventos', description: 'Montaje, meseros, logística y atención en eventos' },
  { name: 'Reparaciones del hogar', description: 'Plomería, electricidad, pintura y arreglos' },
  { name: 'Limpieza', description: 'Aseo de hogares, oficinas y locales' },
  { name: 'Tecnología', description: 'Soporte técnico, desarrollo y redes' },
  { name: 'Edición de video y fotografía', description: 'Grabación, edición y fotografía' },
  { name: 'Atención al cliente y ventas', description: 'Ventas, impulso y servicio al cliente' },
  { name: 'Cocina y alimentos', description: 'Cocina, preparación y servicio de alimentos' },
];

// HU-003 CA2 / RF-03-05: reglas de advertencia de relación laboral (Ley 2466 de 2025). Textos
// PROVISIONALES hasta que asesoría jurídica los apruebe; el código de cada regla está en
// apps/api/src/opportunities/labor-warnings.ts y sus umbrales en params.
const laborWarningRules = [
  {
    code: 'FULL_DAY',
    params: { minMinutes: 480 },
    message:
      'Una jornada de 8 horas o más puede configurar una relación laboral. Si la persona trabajará ' +
      'bajo tus órdenes y en un horario que tú fijas, podría corresponder un contrato de trabajo ' +
      'con sus prestaciones y afiliación a seguridad social.',
  },
  {
    code: 'LONG_TERM',
    params: { minMinutes: 30 * 24 * 60 },
    message:
      'Un proyecto o servicio de un mes o más con la misma persona puede configurar una relación ' +
      'laboral por su continuidad. Revisa si corresponde un contrato de trabajo o de prestación ' +
      'de servicios.',
  },
  {
    code: 'SUBORDINATION_TERMS',
    params: {
      terms: [
        'horario fijo',
        'todos los dias',
        'de lunes a viernes',
        'de lunes a sabado',
        'bajo mis ordenes',
        'subordinacion',
        'uniforme obligatorio',
        'cumplir horario',
      ],
    },
    message:
      'Las condiciones mencionan horario fijo u órdenes permanentes. La subordinación es un ' +
      'elemento del contrato de trabajo: si se cumple, la relación podría ser laboral.',
  },
];

async function main() {
  for (const doc of legalDocuments) {
    await prisma.legalDocument.upsert({
      where: { type_version: { type: doc.type, version: doc.version } },
      update: {},
      create: { ...doc, effectiveFrom: new Date('2026-10-27T00:00:00-05:00') },
    });
  }

  // update vacío: volver a correr el seed no reactiva lo que un administrador desactivó (HU-037).
  for (const name of zones) {
    await prisma.zone.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const rule of laborWarningRules) {
    await prisma.laborWarningRule.upsert({ where: { code: rule.code }, update: {}, create: rule });
  }
  for (const category of categories) {
    await prisma.category.upsert({ where: { name: category.name }, update: {}, create: category });
  }
}

// Un error sin capturar termina el proceso con código 1, que es lo que espera `prisma db seed`.
void main().finally(() => prisma.$disconnect());
