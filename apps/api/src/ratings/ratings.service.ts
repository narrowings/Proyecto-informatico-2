import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Prisma, type RatedRole } from '@prisma/client';
import type { PaginationDto } from '../common/http/pagination.dto';
import { EngagementsService } from '../engagements/engagements.service';
import { PrismaService } from '../prisma/prisma.service';
import { isPrismaError, serializableTransaction } from '../prisma/serializable-transaction';
import type { CreateRatingDto } from './ratings.dto';

export const RATING_PUBLICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const dimensions = {
  fulfillment: true,
  punctuality: true,
  communication: true,
  quality: true,
} as const;
const publicFields = {
  ...dimensions,
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

  async rate(jobId: string, userId: string, dto: CreateRatingDto) {
    const job = await this.engagements.getJobParties(jobId);
    if (!job || ![job.workerUserId, job.publisherUserId].includes(userId)) {
      throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'No encontramos el trabajo' });
    }
    if (job.status !== 'COMPLETED') {
      throw new ConflictException({
        code: 'JOB_NOT_COMPLETED',
        message: 'El trabajo debe estar completado',
      });
    }
    const isWorker = job.workerUserId === userId;
    try {
      return await serializableTransaction(this.prisma, async (tx) => {
        const rating = await tx.rating.create({
          data: {
            ...dto,
            jobId,
            raterUserId: userId,
            rateeUserId: isWorker ? job.publisherUserId : job.workerUserId,
            rateeRole: isWorker ? 'PUBLISHER' : 'WORKER',
          },
          select: publicFields,
        });
        const total = await tx.rating.count({ where: { jobId } });
        if (total < 2) return rating;
        const now = new Date();
        await this.publish(tx, { jobId }, now);
        return { ...rating, publishedAt: now };
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException({
          code: 'ALREADY_RATED',
          message: 'Ya calificaste este trabajo',
        });
      }
      throw error;
    }
  }

  publishDueRatings(now: Date) {
    return serializableTransaction(this.prisma, (tx) =>
      this.publish(
        tx,
        { createdAt: { lte: new Date(now.getTime() - RATING_PUBLICATION_TTL_MS) } },
        now,
      ),
    );
  }

  private async publish(tx: Prisma.TransactionClient, filter: Prisma.RatingWhereInput, now: Date) {
    const where = { ...filter, publishedAt: null };
    const ratees = await tx.rating.findMany({
      where,
      select: { rateeUserId: true, rateeRole: true },
      distinct: ['rateeUserId', 'rateeRole'],
      orderBy: [{ rateeUserId: 'asc' }, { rateeRole: 'asc' }],
    });
    if (!ratees.length) return;
    await tx.rating.updateMany({ where, data: { publishedAt: now } });
    for (const { rateeUserId, rateeRole } of ratees) {
      const { _avg, _count } = await tx.rating.aggregate({
        where: { rateeUserId, rateeRole, publishedAt: { not: null } },
        _avg: dimensions,
        _count: true,
      });
      const fulfillment = new Prisma.Decimal(_avg.fulfillment ?? 0);
      const punctuality = new Prisma.Decimal(_avg.punctuality ?? 0);
      const communication = new Prisma.Decimal(_avg.communication ?? 0);
      const quality = new Prisma.Decimal(_avg.quality ?? 0);
      const values = {
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
        create: { userId: rateeUserId, role: rateeRole, ...values },
        update: values,
      });
    }
  }

  async recordCompletedJob(
    workerUserId: string,
    publisherUserId: string,
    tx: Prisma.TransactionClient,
  ) {
    const parties = [
      { userId: workerUserId, role: 'WORKER' },
      { userId: publisherUserId, role: 'PUBLISHER' },
    ] as const;
    for (const party of parties) {
      await tx.reputationSummary.upsert({
        where: { userId_role: party },
        create: { ...party, completedJobs: 1 },
        update: { completedJobs: { increment: 1 } },
      });
    }
  }

  async getSummary(userId: string, role: RatedRole) {
    const [summary, comments] = await Promise.all([
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
    const ratingsCount = summary?.ratingsCount ?? 0;
    return {
      average: summary?.avgOverall?.toNumber() ?? null,
      fulfillment: summary?.avgFulfillment?.toNumber() ?? null,
      punctuality: summary?.avgPunctuality?.toNumber() ?? null,
      communication: summary?.avgCommunication?.toNumber() ?? null,
      quality: summary?.avgQuality?.toNumber() ?? null,
      ratingsCount,
      completedJobs: summary?.completedJobs ?? 0,
      isNew: ratingsCount === 0,
      recentComments: comments.map(({ comment, publishedAt }) => ({
        text: comment,
        date: publishedAt,
      })),
    };
  }

  async hasRated(jobId: string, raterUserId: string) {
    return Boolean(
      await this.prisma.rating.findUnique({
        where: { jobId_raterUserId: { jobId, raterUserId } },
        select: { id: true },
      }),
    );
  }

  async listOwn(userId: string, { page, pageSize }: PaginationDto) {
    const where = { rateeUserId: userId, publishedAt: { not: null } };
    const [worker, publisher, [total, items]] = await Promise.all([
      this.getSummary(userId, 'WORKER'),
      this.getSummary(userId, 'PUBLISHER'),
      this.prisma.$transaction(
        [
          this.prisma.rating.count({ where }),
          this.prisma.rating.findMany({
            where,
            select: publicFields,
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
