import { Prisma } from '@prisma/client';
import type { PrismaService } from './prisma.service';

export function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// Reintenta únicamente transacciones abortadas por PostgreSQL, sin efectos externos.
export async function serializableTransaction<T>(
  prisma: PrismaService,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (attempt >= 4 || !isPrismaError(error, 'P2034')) throw error;
    }
  }
}
