import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Prisma, type Job, type Selection } from '@prisma/client';
import {
  APPLICATIONS,
  type ApplicationsContract,
  type ApplicationWithParties,
} from '../applications/applications.contract';
import { IdentityService } from '../identity/identity.service';
import {
  NOTIFICATIONS,
  type NotificationsContract,
  type NotifyInput,
} from '../notifications/notifications.contract';
import { OPPORTUNITIES, type OpportunitiesContract } from '../opportunities/opportunities.contract';
import { PrismaService } from '../prisma/prisma.service';
import { isPrismaError, serializableTransaction } from '../prisma/serializable-transaction';
import { RatingsService } from '../ratings/ratings.service';
import type { ListJobsQuery } from './engagements.dto';

export const SELECTION_TTL_MS = 24 * 60 * 60 * 1000;

const notFound = () =>
  new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'No encontramos el recurso' });
const conflict = (code: string, message: string) => new ConflictException({ code, message });

const messages = {
  SELECTION_RECEIVED: 'Te seleccionaron para una oportunidad',
  SELECTION_ACCEPTED: 'Aceptaron la selección',
  SELECTION_REJECTED: 'Rechazaron la selección',
  SELECTION_EXPIRED: 'Venció una selección sin respuesta',
  APPLICATION_STATUS_CHANGED: 'La oportunidad completó sus cupos',
  JOB_FINISH_MARKED: 'La otra persona marcó el trabajo como terminado',
  JOB_COMPLETED: 'El trabajo se completó',
  JOB_CANCELLED: 'La otra persona canceló el trabajo',
  RATING_AVAILABLE: 'Ya puedes calificar el trabajo',
} satisfies Partial<Record<NotifyInput['type'], string>>;

function event(
  userId: string,
  type: keyof typeof messages,
  resourceId: string,
  opportunityTitle: string,
): NotifyInput {
  const title = messages[type];
  const description = title.charAt(0).toLowerCase() + title.slice(1);
  return {
    userId,
    type,
    title,
    body: `"${opportunityTitle}": ${description}`.slice(0, 500),
    link:
      type === 'SELECTION_RECEIVED' ? `/mi-actividad/selecciones/${resourceId}` : '/mi-actividad',
    data: { recursoId: resourceId },
  };
}

@Injectable()
export class EngagementsService {
  private readonly logger = new Logger(EngagementsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OPPORTUNITIES) private readonly opportunities: OpportunitiesContract,
    @Inject(APPLICATIONS) private readonly applications: ApplicationsContract,
    @Inject(NOTIFICATIONS) private readonly notifications: NotificationsContract,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(forwardRef(() => RatingsService)) private readonly ratings: RatingsService,
  ) {}

  private async notify(events: NotifyInput[]) {
    if (!events.length) return;
    try {
      await this.notifications.notifyMany(events);
    } catch {
      this.logger.error('No se pudieron emitir las notificaciones de selección o trabajo');
    }
  }

  private async getOwnedOpportunity(id: string, userId: string) {
    const opportunity = await this.opportunities.getForEngagement(id);
    if (!opportunity || opportunity.publisherUserId !== userId) throw notFound();
    return opportunity;
  }

  private async findSelections(
    tx: Prisma.TransactionClient,
    applications: Pick<ApplicationWithParties, 'id'>[],
  ) {
    return tx.selection.findMany({
      where: { applicationId: { in: applications.map(({ id }) => id) } },
    });
  }

  private countTakenSlots(selections: Selection[], findCancelledJobs: { selectionId: string }[]) {
    const cancelledJobs = new Set(findCancelledJobs.map(({ selectionId }) => selectionId));
    return selections.filter(
      ({ id, status }) => status === 'PENDING' || (status === 'ACCEPTED' && !cancelledJobs.has(id)),
    ).length;
  }

  private findCancelledJobs(tx: Prisma.TransactionClient, opportunityId: string) {
    return tx.job.findMany({
      where: { opportunityId, status: 'CANCELLED' },
      select: { selectionId: true },
    });
  }

  async listApplicants(id: string, userId: string) {
    const opportunity = await this.getOwnedOpportunity(id, userId);
    if (opportunity.type === 'FORMAL_JOB') {
      throw conflict('OPPORTUNITY_NOT_OPEN', 'La oportunidad no admite selecciones');
    }
    const applications = await this.applications.listForOpportunity(id);
    const { selections, cancelledJobs } = await serializableTransaction(
      this.prisma,
      async (tx) => ({
        selections: await this.findSelections(tx, applications),
        cancelledJobs: await this.findCancelledJobs(tx, id),
      }),
    );
    const statuses = new Map(
      selections.map(({ applicationId, status }) => [applicationId, status]),
    );
    const applicants = await Promise.all(
      applications.map(async (application) => ({
        ...application,
        selectionStatus: statuses.get(application.id) ?? null,
        reputation: await this.ratings.getSummary(application.workerUserId, 'WORKER'),
      })),
    );
    return {
      applicants,
      selected: this.countTakenSlots(selections, cancelledJobs),
      needed: opportunity.peopleNeeded,
    };
  }

  async select(id: string, userId: string, applicationIds: string[]) {
    const opportunity = await this.getOwnedOpportunity(id, userId);
    const needed = opportunity.peopleNeeded;
    if (opportunity.status !== 'ACTIVE' || opportunity.type === 'FORMAL_JOB' || !needed) {
      throw conflict('OPPORTUNITY_NOT_OPEN', 'La oportunidad no admite selecciones');
    }
    const selectedApplications = await Promise.all(
      applicationIds.map((applicationId) => this.applications.getWithParties(applicationId)),
    );
    if (
      selectedApplications.some(
        (application) => !application || application.opportunityId !== id.toLowerCase(),
      )
    ) {
      throw notFound();
    }

    let newSelections: Selection[];
    try {
      newSelections = await serializableTransaction(this.prisma, async (tx) => {
        const applications = await this.applications.listForOpportunity(id);
        const received = new Set(
          applications.filter(({ status }) => status === 'RECEIVED').map(({ id }) => id),
        );
        const existing = await this.findSelections(tx, applications);
        const previous = new Set(existing.map(({ applicationId }) => applicationId));
        if (
          applicationIds.some(
            (applicationId) => !received.has(applicationId) || previous.has(applicationId),
          )
        ) {
          throw conflict(
            'APPLICATION_NOT_SELECTABLE',
            'Una postulación ya no está disponible para seleccionar',
          );
        }
        const cancelledJobs = await this.findCancelledJobs(tx, id);
        if (this.countTakenSlots(existing, cancelledJobs) + applicationIds.length > needed) {
          throw conflict('SELECTION_LIMIT_REACHED', 'La selección supera los cupos disponibles');
        }
        const expiresAt = new Date(Date.now() + SELECTION_TTL_MS);
        return tx.selection.createManyAndReturn({
          data: applicationIds.map((applicationId) => ({ applicationId, expiresAt })),
        });
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw conflict('APPLICATION_NOT_SELECTABLE', 'Una postulación ya tiene selección');
      }
      throw error;
    }
    const workers = new Map(
      selectedApplications.map((application) => [application!.id, application!.workerUserId]),
    );
    await this.notify(
      newSelections.map((selection) =>
        event(
          workers.get(selection.applicationId)!,
          'SELECTION_RECEIVED',
          selection.id,
          opportunity.title,
        ),
      ),
    );
    return newSelections;
  }

  async listOwnSelections(userId: string) {
    const { applicationIds } = await this.applications.listIdsForWorkerUser(userId);
    if (!applicationIds.length) return [];
    const pending = await this.prisma.selection.findMany({
      where: {
        applicationId: { in: applicationIds },
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const results = await Promise.all(
      pending.map(async (selection) => {
        const application = await this.applications.getWithParties(selection.applicationId);
        if (application?.workerUserId !== userId) return null;
        const opportunity = await this.opportunities.getForEngagement(application.opportunityId);
        if (!opportunity) return null;
        const { id, title, zone, scheduledAt } = opportunity;
        return {
          id: selection.id,
          status: selection.status,
          expiresAt: selection.expiresAt,
          opportunity: { id, title, zone, scheduledAt },
        };
      }),
    );
    return results.filter((result) => result !== null);
  }

  private async getOwnedSelection(id: string, userId: string) {
    const selection = await this.prisma.selection.findUnique({ where: { id } });
    if (!selection) throw notFound();
    const application = await this.applications.getWithParties(selection.applicationId);
    if (!application || application.workerUserId !== userId) throw notFound();
    const opportunity = await this.opportunities.getForEngagement(application.opportunityId);
    if (!opportunity) throw notFound();
    return { selection, application, opportunity };
  }

  async accept(id: string, userId: string, acceptTerms: true) {
    if (acceptTerms !== true) {
      throw new BadRequestException({
        message: 'Revisa los campos marcados',
        errors: { acceptTerms: ['Debes aceptar los términos del trabajo'] },
      });
    }
    const { application, opportunity } = await this.getOwnedSelection(id, userId);
    if (
      !opportunity.scheduledAt ||
      !opportunity.peopleNeeded ||
      opportunity.type === 'FORMAL_JOB' ||
      opportunity.status !== 'ACTIVE' ||
      application.status !== 'RECEIVED'
    ) {
      throw conflict('SELECTION_NOT_AVAILABLE', 'La selección ya no está disponible');
    }
    const { scheduledAt, peopleNeeded } = opportunity;
    const { job, rejected, isFilled } = await serializableTransaction(this.prisma, async (tx) => {
      const now = new Date();
      const result = await tx.selection.updateMany({
        where: { id, status: 'PENDING', expiresAt: { gt: now } },
        data: { status: 'ACCEPTED', respondedAt: now, termsAcceptedAt: now },
      });
      if (!result.count)
        throw conflict('SELECTION_NOT_AVAILABLE', 'La selección ya fue respondida o venció');
      const job = await tx.job.create({
        data: {
          selectionId: id,
          opportunityId: opportunity.id,
          workerProfileId: application.workerProfileId,
          scheduledAt,
        },
      });
      const accepted = await tx.job.count({
        where: { opportunityId: opportunity.id, status: { not: 'CANCELLED' } },
      });
      const isFilled = accepted >= peopleNeeded;
      const rejected = [];
      if (isFilled) {
        const applicants = await this.applications.listForOpportunity(opportunity.id);
        const existing = new Set(
          (await this.findSelections(tx, applicants)).map(({ applicationId }) => applicationId),
        );
        rejected.push(
          ...applicants.filter(
            (applicant) => applicant.status === 'RECEIVED' && !existing.has(applicant.id),
          ),
        );
      }
      return { job, rejected, isFilled };
    });

    await this.applications.setStatus(application.id, 'ACCEPTED');
    if (isFilled) {
      await this.opportunities.markFilled(opportunity.id);
      await Promise.all(rejected.map(({ id }) => this.applications.setStatus(id, 'REJECTED')));
    }
    await this.notify([
      event(opportunity.publisherUserId, 'SELECTION_ACCEPTED', id, opportunity.title),
      ...rejected.map(({ workerUserId, id }) =>
        event(workerUserId, 'APPLICATION_STATUS_CHANGED', id, opportunity.title),
      ),
    ]);
    return job;
  }

  async reject(id: string, userId: string) {
    const { opportunity } = await this.getOwnedSelection(id, userId);
    const now = new Date();
    const result = await this.prisma.selection.updateMany({
      where: { id, status: 'PENDING', expiresAt: { gt: now } },
      data: { status: 'REJECTED', respondedAt: now },
    });
    if (!result.count)
      throw conflict('SELECTION_NOT_AVAILABLE', 'La selección ya fue respondida o venció');
    await this.opportunities.reopenIfFilled(opportunity.id);
    await this.notify([
      event(opportunity.publisherUserId, 'SELECTION_REJECTED', id, opportunity.title),
    ]);
  }

  async expireSelections(now: Date) {
    const pending = await this.prisma.selection.findMany({
      where: { status: 'PENDING', expiresAt: { lte: now } },
    });
    for (const { id, applicationId } of pending) {
      const result = await this.prisma.selection.updateMany({
        where: { id, status: 'PENDING', expiresAt: { lte: now } },
        data: { status: 'EXPIRED', respondedAt: now },
      });
      if (!result.count) continue;
      const application = await this.applications.getWithParties(applicationId);
      if (!application) continue;
      const opportunity = await this.opportunities.getForEngagement(application.opportunityId);
      if (!opportunity) continue;
      await this.opportunities.reopenIfFilled(opportunity.id);
      await this.notify([
        event(opportunity.publisherUserId, 'SELECTION_EXPIRED', id, opportunity.title),
      ]);
    }
  }

  startDueJobs(now: Date) {
    return this.prisma.job.updateMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
      data: { status: 'IN_PROGRESS' },
    });
  }

  private async resolveJobParties(job: Job) {
    const [selection, opportunity] = await Promise.all([
      this.prisma.selection.findUnique({ where: { id: job.selectionId } }),
      this.opportunities.getForEngagement(job.opportunityId),
    ]);
    if (!opportunity || !selection || selection.status !== 'ACCEPTED' || !selection.termsAcceptedAt)
      return null;
    const application = await this.applications.getWithParties(selection.applicationId);
    if (!application) return null;
    return {
      job,
      opportunity,
      workerUserId: application.workerUserId,
      publisherUserId: opportunity.publisherUserId,
    };
  }

  async getJobParties(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    const parties = job && (await this.resolveJobParties(job));
    return (
      parties && {
        status: parties.job.status,
        workerUserId: parties.workerUserId,
        publisherUserId: parties.publisherUserId,
      }
    );
  }

  private async getOwnedJob(id: string, userId: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    const parties = job && (await this.resolveJobParties(job));
    if (!parties || ![parties.workerUserId, parties.publisherUserId].includes(userId))
      throw notFound();
    const counterpartId =
      parties.workerUserId === userId ? parties.publisherUserId : parties.workerUserId;
    return { ...parties, counterpartId };
  }

  async listOwnJobs(userId: string, { page, pageSize, role, state }: ListJobsQuery) {
    const statuses: Job['status'][] =
      state === 'active' ? ['SCHEDULED', 'IN_PROGRESS'] : ['COMPLETED', 'CANCELLED'];
    const where: Prisma.JobWhereInput = { status: { in: statuses } };
    if (role === 'worker') {
      const { workerProfileId } = await this.applications.listIdsForWorkerUser(userId);
      if (!workerProfileId) return { items: [], total: 0, page, pageSize };
      where.workerProfileId = workerProfileId;
    } else {
      const opportunityIds = await this.opportunities.listIdsForPublisherUser(userId);
      if (!opportunityIds.length) return { items: [], total: 0, page, pageSize };
      where.opportunityId = { in: opportunityIds };
    }

    const [total, jobs] = await this.prisma.$transaction(
      [
        this.prisma.job.count({ where }),
        this.prisma.job.findMany({
          where,
          orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const items = await Promise.all(
      jobs.map(async (job) => {
        const parties = await this.resolveJobParties(job);
        if (!parties) return null;
        const counterpartId = role === 'worker' ? parties.publisherUserId : parties.workerUserId;
        const contact = await this.identity.getContact(counterpartId);
        const { title, type, zone } = parties.opportunity;
        const { id, status, scheduledAt } = job;
        return {
          id,
          title,
          type,
          zone,
          status,
          scheduledAt,
          counterparty: { name: contact?.name ?? null },
        };
      }),
    );
    return { items: items.filter((item) => item !== null), total, page, pageSize };
  }

  async getJobDetail(id: string, userId: string) {
    const { job, opportunity, counterpartId } = await this.getOwnedJob(id, userId);
    const [counterparty, hasRated] = await Promise.all([
      this.identity.getContact(counterpartId),
      this.ratings.hasRated(id, userId),
    ]);
    const { title, type, zone, exactAddress } = opportunity;
    return {
      id: job.id,
      status: job.status,
      scheduledAt: job.scheduledAt,
      finishMarkedAt: job.finishMarkedAt,
      completedAt: job.completedAt,
      cancelledAt: job.cancelledAt,
      cancelReason: job.cancelReason,
      createdAt: job.createdAt,
      title,
      type,
      zone,
      exactAddress,
      counterparty: counterparty && { name: counterparty.name, phone: counterparty.phone },
      hasRated,
      finishMarkedByMe: job.finishMarkedById === userId,
      cancelledByMe: job.cancelledById === userId,
    };
  }

  async markFinished(id: string, userId: string) {
    const { counterpartId, opportunity } = await this.getOwnedJob(id, userId);
    const result = await this.prisma.job.updateMany({
      where: { id, status: 'IN_PROGRESS', finishMarkedById: null },
      data: { finishMarkedAt: new Date(), finishMarkedById: userId },
    });
    if (result.count) {
      await this.notify([event(counterpartId, 'JOB_FINISH_MARKED', id, opportunity.title)]);
      return;
    }
    const current = await this.prisma.job.findUnique({ where: { id } });
    if (current?.status === 'IN_PROGRESS' && current.finishMarkedById === userId) return;
    throw conflict('JOB_FINISH_NOT_AVAILABLE', 'El trabajo no se puede marcar como terminado');
  }

  async confirmFinished(id: string, userId: string) {
    const { job, workerUserId, publisherUserId, opportunity } = await this.getOwnedJob(id, userId);
    if (job.status !== 'IN_PROGRESS' || !job.finishMarkedById) {
      throw conflict(
        'JOB_FINISH_NOT_AVAILABLE',
        'El trabajo debe estar en curso y marcado como terminado',
      );
    }
    if (job.finishMarkedById === userId) {
      throw conflict(
        'FINISH_NEEDS_OTHER_PARTY',
        'La otra parte debe confirmar la finalización del trabajo',
      );
    }
    await serializableTransaction(this.prisma, async (tx) => {
      const result = await tx.job.updateMany({
        where: { id, status: 'IN_PROGRESS', finishMarkedById: job.finishMarkedById },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      if (!result.count)
        throw conflict('JOB_FINISH_NOT_AVAILABLE', 'El trabajo ya no se puede confirmar');
      await this.ratings.recordCompletedJob(workerUserId, publisherUserId, tx);
    });
    await this.notify(
      [workerUserId, publisherUserId].flatMap((user) => [
        event(user, 'JOB_COMPLETED', id, opportunity.title),
        event(user, 'RATING_AVAILABLE', id, opportunity.title),
      ]),
    );
  }

  async cancelJob(id: string, userId: string, reason: string) {
    const { opportunity, counterpartId } = await this.getOwnedJob(id, userId);
    const result = await this.prisma.job.updateMany({
      where: { id, status: 'SCHEDULED' },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: userId,
        cancelReason: reason,
      },
    });
    if (!result.count)
      throw conflict('JOB_CANNOT_BE_CANCELLED', 'Solo puedes cancelar un trabajo programado');
    await this.opportunities.reopenIfFilled(opportunity.id);
    await this.notify([event(counterpartId, 'JOB_CANCELLED', id, opportunity.title)]);
  }
}
