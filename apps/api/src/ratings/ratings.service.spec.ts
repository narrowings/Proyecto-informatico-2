import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { EngagementsService } from '../engagements/engagements.service';
import type { PrismaService } from '../prisma/prisma.service';
import { RATING_PUBLICATION_TTL_MS, RatingsService } from './ratings.service';

const calificacion = { fulfillment: 5, punctuality: 3, communication: 2, quality: 1 };

function preparar() {
  const partes = {
    getJobParties: vi.fn().mockResolvedValue({
      workerUserId: 'trabajador',
      publisherUserId: 'publicador',
      status: 'COMPLETED',
    }),
  };
  const tx = {
    rating: {
      create: vi.fn().mockResolvedValue({ ...calificacion, id: 'r', publishedAt: null }),
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({
        _avg: { fulfillment: 4.123, punctuality: 2.666, communication: 2, quality: 1 },
        _count: 3,
      }),
    },
    reputationSummary: { upsert: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
  };
  const prisma = { ...tx, $transaction: (operar: (cliente: typeof tx) => unknown) => operar(tx) };
  return {
    partes,
    tx,
    servicio: new RatingsService(
      prisma as unknown as PrismaService,
      partes as unknown as EngagementsService,
    ),
  };
}

describe('HU-007 Calificaciones', () => {
  it('rechaza una calificación duplicada', async () => {
    const { servicio, tx } = preparar();
    tx.rating.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicada', { code: 'P2002', clientVersion: '6' }),
    );
    await expect(servicio.calificar('t', 'trabajador', calificacion)).rejects.toMatchObject({
      response: { code: 'ALREADY_RATED' },
    });
  });

  it('rechaza calificar trabajos que no están completados', async () => {
    const { servicio, tx, partes } = preparar();
    partes.getJobParties.mockResolvedValue({ workerUserId: 'trabajador', status: 'IN_PROGRESS' });
    await expect(servicio.calificar('t', 'trabajador', calificacion)).rejects.toMatchObject({
      response: { code: 'JOB_NOT_COMPLETED' },
    });
    expect(tx.rating.create).not.toHaveBeenCalled();
  });

  it('publica ambas cuando llega la segunda y calcula los promedios a dos decimales', async () => {
    const { servicio, tx } = preparar();
    tx.rating.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    tx.rating.findMany.mockResolvedValue([
      { rateeUserId: 'publicador', rateeRole: 'PUBLISHER' },
      { rateeUserId: 'trabajador', rateeRole: 'WORKER' },
    ]);
    await expect(servicio.calificar('t', 'trabajador', calificacion)).resolves.toMatchObject({
      publishedAt: null,
    });
    expect(tx.rating.updateMany).not.toHaveBeenCalled();
    await expect(servicio.calificar('t', 'publicador', calificacion)).resolves.toMatchObject({
      publishedAt: expect.any(Date),
    });
    expect(tx.rating.updateMany).toHaveBeenCalledWith({
      where: { jobId: 't', publishedAt: null },
      data: { publishedAt: expect.any(Date) },
    });
    expect(tx.reputationSummary.upsert).toHaveBeenCalledTimes(2);
    expect(tx.reputationSummary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          avgFulfillment: new Prisma.Decimal(4.12),
          avgPunctuality: new Prisma.Decimal(2.67),
          avgCommunication: new Prisma.Decimal(2),
          avgQuality: new Prisma.Decimal(1),
          avgOverall: new Prisma.Decimal(2.45),
          ratingsCount: 3,
        },
      }),
    );
  });

  it('publica exactamente a los 7 días y no un milisegundo antes', async () => {
    const { servicio, tx } = preparar();
    const creada = new Date('2026-11-13T00:00:00Z');
    tx.rating.findMany.mockImplementation(({ where }) =>
      Promise.resolve(
        where.createdAt.lte >= creada
          ? [{ rateeUserId: 'publicador', rateeRole: 'PUBLISHER' }]
          : [],
      ),
    );
    await servicio.publishDueRatings(new Date(creada.getTime() + RATING_PUBLICATION_TTL_MS - 1));
    expect(tx.rating.updateMany).not.toHaveBeenCalled();
    const publicada = new Date(creada.getTime() + RATING_PUBLICATION_TTL_MS);
    await servicio.publishDueRatings(publicada);
    expect(tx.rating.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { createdAt: { lte: creada }, publishedAt: null },
      data: { publishedAt: publicada },
    });
  });

  it('HU-046 muestra como nueva a una persona sin calificaciones públicas', async () => {
    const { servicio } = preparar();
    await expect(servicio.getSummary('trabajador', 'WORKER')).resolves.toMatchObject({
      isNew: true,
      average: null,
      ratingsCount: 0,
      completedJobs: 0,
      recentComments: [],
    });
  });
});
