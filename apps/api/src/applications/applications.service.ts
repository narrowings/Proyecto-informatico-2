import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, OpportunityType, Prisma } from '@prisma/client';
import { IdentityService } from '../identity/identity.service';
import { NOTIFICATIONS, type NotificationsContract } from '../notifications/notifications.contract';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkerProfilesService } from '../profiles/worker-profiles.service';
import type {
  ApplicantSummary,
  ApplicationsContract,
  ApplicationWithParties,
} from './applications.contract';
import type {
  ApplyDto,
  ChangeApplicationStatusDto,
  ListMyApplicationsQuery,
} from './dto/applications.dto';

const { RECEIVED, IN_REVIEW, INTERVIEW, ACCEPTED, WITHDRAWN } = ApplicationStatus;
// HU-013 CA1: "Postulaciones activas".
export const ACTIVE_STATUSES = [RECEIVED, IN_REVIEW, INTERVIEW];

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  RECEIVED: 'Recibida',
  IN_REVIEW: 'En revisión',
  INTERVIEW: 'Entrevista',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  WITHDRAWN: 'Retirada',
};

const notFound = () => new NotFoundException('Oportunidad no encontrada');

@Injectable()
export class ApplicationsService implements ApplicationsContract {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OpportunitiesService) private readonly opportunities: OpportunitiesService,
    @Inject(WorkerProfilesService) private readonly workers: WorkerProfilesService,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(NOTIFICATIONS) private readonly notifications: NotificationsContract,
  ) {}

  // ─── HU-005: "Me interesa" / "Postularme" ──────────────────────────────────

  async apply(userId: string, opportunityId: string, dto: ApplyDto, now = new Date()) {
    // HU-005 CA5: indica qué falta para que el frontend lleve a completarlo.
    if (!(await this.identity.isAccountActive(userId))) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_CONFIRMED',
        message: 'Confirma tu correo antes de postularte',
      });
    }
    const workerProfileId = await this.workers.getIdForUser(userId);
    if (!workerProfileId) {
      throw new ForbiddenException({
        code: 'WORKER_PROFILE_REQUIRED',
        message: 'Completa tu perfil de trabajador antes de postularte',
      });
    }
    const opportunity = await this.opportunities.getForEngagement(opportunityId);
    if (!opportunity || opportunity.status === 'CANCELLED') throw notFound();
    // RN-07: nadie se postula a sus propias publicaciones.
    if (opportunity.publisherUserId === userId) {
      throw new ConflictException({
        code: 'OWN_OPPORTUNITY',
        message: 'No puedes postularte a tu propia publicación',
      });
    }
    // HU-005 CA3: cerrada, con cupos completos (cerrada por engagements) o vencida.
    const view = (await this.opportunities.getPublicByIds([opportunityId])).get(opportunityId);
    if (!view || !this.opportunities.isOpenForApplications(view, now)) {
      throw new ConflictException({
        code: 'OPPORTUNITY_NOT_AVAILABLE',
        message: 'Esta oportunidad ya no está disponible',
      });
    }

    try {
      const application = await this.prisma.application.create({
        data: {
          opportunityId,
          workerProfileId,
          // HU-005 CA4: el mensaje solo aplica a vacantes formales.
          message: opportunity.type === OpportunityType.FORMAL_JOB ? dto.message || null : null,
        },
        select: { id: true, status: true, opportunityId: true, message: true, createdAt: true },
      });
      await this.notifications.notify({
        userId: opportunity.publisherUserId,
        type: 'NEW_APPLICANT',
        title: 'Un nuevo perfil está interesado en tu oportunidad',
        body: `"${opportunity.title}"`.slice(0, 500),
        link: '/mi-actividad',
        data: { opportunityId },
      });
      return application;
    } catch (error) {
      // HU-005 CA2 / RF-05-02: un segundo envío (o dos simultáneos) no crea otra postulación.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'ALREADY_APPLIED',
          message: 'Ya te postulaste a esta oportunidad',
        });
      }
      throw error;
    }
  }

  // HU-013 CA1: "Postulaciones activas" del trabajador, con la oportunidad de cada una.
  async listMine(userId: string, { page, pageSize, state }: ListMyApplicationsQuery) {
    const workerProfileId = await this.workers.getIdForUser(userId);
    if (!workerProfileId) return { items: [], total: 0, page, pageSize };
    const where: Prisma.ApplicationWhereInput = {
      workerProfileId,
      ...(state === 'active' && { status: { in: ACTIVE_STATUSES } }),
    };
    const [total, rows] = await Promise.all([
      this.prisma.application.count({ where }),
      this.prisma.application.findMany({
        where,
        select: { id: true, status: true, opportunityId: true, message: true, createdAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const opportunities = await this.opportunities.getPublicByIds(
      rows.map((row) => row.opportunityId),
    );
    return {
      items: rows.map((row) => ({
        ...row,
        opportunity: opportunities.get(row.opportunityId) ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  // HU-005 CA2: estado de la postulación propia en cada tarjeta ("Postulado").
  async statusFor(userId: string, opportunityIds: string[]) {
    const workerProfileId = await this.workers.getIdForUser(userId);
    if (!workerProfileId || opportunityIds.length === 0) return {};
    const rows = await this.prisma.application.findMany({
      where: { workerProfileId, opportunityId: { in: opportunityIds } },
      select: { opportunityId: true, status: true },
    });
    return Object.fromEntries(rows.map((row) => [row.opportunityId, row.status]));
  }

  // ─── HU-024 CA2–CA3: postulantes de vacantes formales ──────────────────────

  async listCandidates(userId: string, opportunityId: string) {
    await this.ownedFormalOpportunity(userId, opportunityId);
    return this.listForOpportunity(opportunityId);
  }

  async changeStatus(userId: string, applicationId: string, dto: ChangeApplicationStatusDto) {
    const application = await this.getWithParties(applicationId);
    if (!application) throw new NotFoundException('Postulación no encontrada');
    const opportunity = await this.ownedFormalOpportunity(userId, application.opportunityId);
    // Condicional: dos cambios simultáneos no pisan una decisión final.
    const { count } = await this.prisma.application.updateMany({
      where: { id: applicationId, status: { in: ACTIVE_STATUSES } },
      data: { status: dto.status },
    });
    if (count === 0) {
      throw new ConflictException({
        code: 'APPLICATION_CLOSED',
        message: 'Esta postulación ya fue aceptada, rechazada o retirada',
      });
    }
    await this.notifications.notify({
      userId: application.workerUserId,
      type: 'APPLICATION_STATUS_CHANGED',
      title: `Tu postulación ahora está: ${STATUS_LABELS[dto.status]}`,
      body: `"${opportunity.title}"`.slice(0, 500),
      link: '/mi-actividad',
      data: { opportunityId: opportunity.id, status: dto.status },
    });
    return { id: applicationId, status: dto.status };
  }

  // ─── Contrato APPLICATIONS (engagements) ───────────────────────────────────

  async getWithParties(applicationId: string): Promise<ApplicationWithParties | null> {
    const row = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        opportunityId: true,
        workerProfileId: true,
        createdAt: true,
      },
    });
    if (!row) return null;
    const worker = (await this.workers.getCards([row.workerProfileId])).get(row.workerProfileId);
    return worker ? { ...row, workerUserId: worker.userId } : null;
  }

  async listForOpportunity(opportunityId: string): Promise<ApplicantSummary[]> {
    const rows = await this.prisma.application.findMany({
      where: { opportunityId, status: { not: WITHDRAWN } },
      select: {
        id: true,
        status: true,
        opportunityId: true,
        workerProfileId: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const workers = await this.workers.getCards(rows.map((row) => row.workerProfileId));
    return rows.flatMap((row) => {
      const worker = workers.get(row.workerProfileId);
      if (!worker) return [];
      return [
        {
          ...row,
          workerUserId: worker.userId,
          worker: {
            displayName: worker.displayName,
            photoUrl: worker.photoUrl,
            availability: worker.availability,
            zone: worker.zone,
            skills: worker.skills,
          },
        },
      ];
    });
  }

  async setStatus(applicationId: string, status: ApplicationStatus) {
    await this.prisma.application.update({ where: { id: applicationId }, data: { status } });
  }

  async listIdsForWorkerUser(userId: string) {
    const workerProfileId = await this.workers.getIdForUser(userId);
    if (!workerProfileId) return { workerProfileId: null, applicationIds: [] };
    const rows = await this.prisma.application.findMany({
      where: { workerProfileId },
      select: { id: true },
    });
    return { workerProfileId, applicationIds: rows.map((row) => row.id) };
  }

  async countForOpportunities(opportunityIds: string[]) {
    const counts = new Map<string, { applicants: number; accepted: number }>(
      opportunityIds.map((id) => [id, { applicants: 0, accepted: 0 }]),
    );
    if (opportunityIds.length === 0) return counts;
    const groups = await this.prisma.application.groupBy({
      by: ['opportunityId', 'status'],
      where: { opportunityId: { in: opportunityIds }, status: { not: WITHDRAWN } },
      _count: { _all: true },
    });
    for (const group of groups) {
      const entry = counts.get(group.opportunityId);
      if (!entry) continue;
      entry.applicants += group._count._all;
      if (group.status === ACCEPTED) entry.accepted += group._count._all;
    }
    return counts;
  }

  private async ownedFormalOpportunity(userId: string, opportunityId: string) {
    const opportunity = await this.opportunities.getForEngagement(opportunityId);
    // 404 si no existe o no es del usuario (sin IDOR).
    if (!opportunity || opportunity.publisherUserId !== userId) throw notFound();
    if (opportunity.type !== OpportunityType.FORMAL_JOB) {
      throw new ConflictException({
        code: 'NOT_A_FORMAL_JOB',
        message: 'Los interesados de tareas se gestionan con la selección',
      });
    }
    return opportunity;
  }
}
