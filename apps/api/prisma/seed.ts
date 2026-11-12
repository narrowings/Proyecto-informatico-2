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

async function main() {
  for (const doc of legalDocuments) {
    await prisma.legalDocument.upsert({
      where: { type_version: { type: doc.type, version: doc.version } },
      update: {},
      create: { ...doc, effectiveFrom: new Date('2026-10-27T00:00:00-05:00') },
    });
  }

  // T-03 (Santiago López): zonas de Cali y categorías.
}

// Un error sin capturar termina el proceso con código 1, que es lo que espera `prisma db seed`.
void main().finally(() => prisma.$disconnect());
