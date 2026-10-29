import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

const withPrisma = (queryRaw: () => Promise<unknown>) =>
  new HealthController({ $queryRaw: vi.fn(queryRaw) } as unknown as PrismaService);

describe('HealthController', () => {
  it('responde ok cuando la base de datos contesta', async () => {
    const controller = withPrisma(() => Promise.resolve([{ '?column?': 1 }]));
    await expect(controller.check()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('responde 503 cuando la base de datos no contesta', async () => {
    const controller = withPrisma(() => Promise.reject(new Error('ECONNREFUSED')));
    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
