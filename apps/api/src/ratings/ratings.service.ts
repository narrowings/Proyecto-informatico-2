import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Prisma, type RatedRole } from '@prisma/client';
import type { PaginacionDto } from '../common/http/paginacion.dto';
import { EngagementsService } from '../engagements/engagements.service';
import { PrismaService } from '../prisma/prisma.service';
import { esErrorPrisma, transaccionSerializable } from '../prisma/transaccion-serializable';
import type { CalificacionDto } from './ratings.dto';

export const RATING_PUBLICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const dimensiones = {
  fulfillment: true,
  punctuality: true,
  communication: true,
  quality: true,
} as const;
const datosPublicos = {
  ...dimensiones,
  id: true,
  comment: true,
  rateeRole: true,
  jobId: true,
  publishedAt: true,
} as const;

@Injectable()
export class RatingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => EngagementsService)) private readonly engagements: EngagementsService,
  ) {}

  async calificar(jobId: string, usuarioId: string, dto: CalificacionDto) {
    const trabajo = await this.engagements.getJobParties(jobId);
    if (!trabajo || ![trabajo.workerUserId, trabajo.publisherUserId].includes(usuarioId)) {
      throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'No encontramos el trabajo' });
    }
    if (trabajo.status !== 'COMPLETED') {
      throw new ConflictException({
        code: 'JOB_NOT_COMPLETED',
        message: 'El trabajo debe estar completado',
      });
    }
    const esTrabajador = trabajo.workerUserId === usuarioId;
    try {
      return await transaccionSerializable(this.prisma, async (tx) => {
        const calificacion = await tx.rating.create({
          data: {
            ...dto,
            jobId,
            raterUserId: usuarioId,
            rateeUserId: esTrabajador ? trabajo.publisherUserId : trabajo.workerUserId,
            rateeRole: esTrabajador ? 'PUBLISHER' : 'WORKER',
          },
          select: datosPublicos,
        });
        const total = await tx.rating.count({ where: { jobId } });
        if (total < 2) return calificacion;
        const ahora = new Date();
        await this.publicar(tx, { jobId }, ahora);
        return { ...calificacion, publishedAt: ahora };
      });
    } catch (error) {
      if (esErrorPrisma(error, 'P2002')) {
        throw new ConflictException({
          code: 'ALREADY_RATED',
          message: 'Ya calificaste este trabajo',
        });
      }
      throw error;
    }
  }

  publishDueRatings(now: Date) {
    return transaccionSerializable(this.prisma, (tx) =>
      this.publicar(
        tx,
        { createdAt: { lte: new Date(now.getTime() - RATING_PUBLICATION_TTL_MS) } },
        now,
      ),
    );
  }

  private async publicar(
    tx: Prisma.TransactionClient,
    filtro: Prisma.RatingWhereInput,
    ahora: Date,
  ) {
    const where = { ...filtro, publishedAt: null };
    const receptores = await tx.rating.findMany({
      where,
      select: { rateeUserId: true, rateeRole: true },
      distinct: ['rateeUserId', 'rateeRole'],
      orderBy: [{ rateeUserId: 'asc' }, { rateeRole: 'asc' }],
    });
    if (!receptores.length) return;
    await tx.rating.updateMany({ where, data: { publishedAt: ahora } });
    for (const { rateeUserId, rateeRole } of receptores) {
      const { _avg, _count } = await tx.rating.aggregate({
        where: { rateeUserId, rateeRole, publishedAt: { not: null } },
        _avg: dimensiones,
        _count: true,
      });
      const fulfillment = new Prisma.Decimal(_avg.fulfillment ?? 0);
      const punctuality = new Prisma.Decimal(_avg.punctuality ?? 0);
      const communication = new Prisma.Decimal(_avg.communication ?? 0);
      const quality = new Prisma.Decimal(_avg.quality ?? 0);
      const valores = {
        ratingsCount: _count,
        avgFulfillment: fulfillment.toDecimalPlaces(2),
        avgPunctuality: punctuality.toDecimalPlaces(2),
        avgCommunication: communication.toDecimalPlaces(2),
        avgQuality: quality.toDecimalPlaces(2),
        avgOverall: fulfillment
          .plus(punctuality)
          .plus(communication)
          .plus(quality)
          .div(4)
          .toDecimalPlaces(2),
      };
      await tx.reputationSummary.upsert({
        where: { userId_role: { userId: rateeUserId, role: rateeRole } },
        create: { userId: rateeUserId, role: rateeRole, ...valores },
        update: valores,
      });
    }
  }

  async recordCompletedJob(
    workerUserId: string,
    publisherUserId: string,
    tx: Prisma.TransactionClient,
  ) {
    const partes = [
      { userId: workerUserId, role: 'WORKER' },
      { userId: publisherUserId, role: 'PUBLISHER' },
    ] as const;
    for (const parte of partes) {
      await tx.reputationSummary.upsert({
        where: { userId_role: parte },
        create: { ...parte, completedJobs: 1 },
        update: { completedJobs: { increment: 1 } },
      });
    }
  }

  async getSummary(userId: string, role: RatedRole) {
    const [resumen, comentarios] = await Promise.all([
      this.prisma.reputationSummary.findUnique({ where: { userId_role: { userId, role } } }),
      this.prisma.rating.findMany({
        where: {
          rateeUserId: userId,
          rateeRole: role,
          publishedAt: { not: null },
          comment: { not: '' },
        },
        select: { comment: true, publishedAt: true },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
    ]);
    const ratingsCount = resumen?.ratingsCount ?? 0;
    return {
      average: resumen?.avgOverall?.toNumber() ?? null,
      fulfillment: resumen?.avgFulfillment?.toNumber() ?? null,
      punctuality: resumen?.avgPunctuality?.toNumber() ?? null,
      communication: resumen?.avgCommunication?.toNumber() ?? null,
      quality: resumen?.avgQuality?.toNumber() ?? null,
      ratingsCount,
      completedJobs: resumen?.completedJobs ?? 0,
      isNew: ratingsCount === 0,
      recentComments: comentarios.map(({ comment, publishedAt }) => ({
        text: comment,
        date: publishedAt,
      })),
    };
  }

  async yaCalifico(jobId: string, raterUserId: string) {
    return Boolean(
      await this.prisma.rating.findUnique({
        where: { jobId_raterUserId: { jobId, raterUserId } },
        select: { id: true },
      }),
    );
  }

  async propias(usuarioId: string, { page, pageSize }: PaginacionDto) {
    const where = { rateeUserId: usuarioId, publishedAt: { not: null } };
    const [worker, publisher, [total, items]] = await Promise.all([
      this.getSummary(usuarioId, 'WORKER'),
      this.getSummary(usuarioId, 'PUBLISHER'),
      this.prisma.$transaction(
        [
          this.prisma.rating.count({ where }),
          this.prisma.rating.findMany({
            where,
            select: datosPublicos,
            orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      ),
    ]);
    return { worker, publisher, ratings: { items, total, page, pageSize } };
  }
}
