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
  for (const category of categories) {
    await prisma.category.upsert({ where: { name: category.name }, update: {}, create: category });
  }
}

// Un error sin capturar termina el proceso con código 1, que es lo que espera `prisma db seed`.
void main().finally(() => prisma.$disconnect());
