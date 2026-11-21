import { Prisma } from '@prisma/client';
import type { PrismaService } from './prisma.service';

export function esErrorPrisma(error: unknown, codigo: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === codigo;
}

// Reintenta únicamente transacciones abortadas por PostgreSQL, sin efectos externos.
export async function transaccionSerializable<T>(
  prisma: PrismaService,
  operacion: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let intento = 1; ; intento++) {
    try {
      return await prisma.$transaction(operacion, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (intento >= 4 || !esErrorPrisma(error, 'P2034')) throw error;
    }
  }
}
