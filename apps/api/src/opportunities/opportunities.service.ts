import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { OpportunityStatus, OpportunityType, Prisma, type Opportunity } from '@prisma/client';
import {
  APPLICATIONS,
  type ApplicantSummary,
  type ApplicationsContract,
} from '../applications/applications.contract';
import { CatalogsService } from '../catalogs/catalogs.service';
import { validationPipe } from '../common/validation';
import { IdentityService } from '../identity/identity.service';
import {
  NOTIFICATIONS,
  type NotificationsContract,
  type NotifyInput,
} from '../notifications/notifications.contract';
import { PrismaService } from '../prisma/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import type { ListOpportunitiesQuery, PageQuery } from './dto/list-opportunities.query';
import type { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { evaluateLaborWarnings, type LaborWarning } from './labor-warnings';
import type { OpportunitiesContract, OpportunityForEngagement } from './opportunities.contract';
import { buildSearchText, normalizeSearch } from './search-text';

// RF-05-09: motivo con el que se cierra al completar los cupos; reopenIfFilled solo reabre estas.
export const FILLED_REASON = 'Cupos completos';
export const DEFAULT_PAGE_SIZE = 20;

const { ACTIVE, PAUSED, CLOSED, EXPIRED, CANCELLED } = OpportunityStatus;
const isFormalType = (type: OpportunityType) => type === OpportunityType.FORMAL_JOB;

const notFound = () => new NotFoundException('Oportunidad no encontrada');
const invalidTransition = () =>
  new ConflictException({
    code: 'INVALID_STATUS_TRANSITION',
    message: 'La publicación no permite ese cambio en su estado actual',
  });

const fieldError = (field: string, message: string) =>
  new BadRequestException({
    message: 'Revisa los campos marcados',
    errors: { [field]: [message] },
  });

const cardInclude = {
  zone: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.OpportunityInclude;

type OpportunityWithCatalogs = Prisma.OpportunityGetPayload<{ include: typeof cardInclude }>;
type PublisherCard = {
  id: string;
  kind: string;
  displayName: string;
  photoUrl: string;
  isVerified: boolean;
};

@Injectable()
export class OpportunitiesService implements OpportunitiesContract {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogsService) private readonly catalogs: CatalogsService,
    @Inject(ProfilesService) private readonly profiles: ProfilesService,
    @Inject(IdentityService) private readonly identity: IdentityService,
    // applications depende de opportunities: se resuelve al usarlo para no crear un ciclo.
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Optional() @Inject(NOTIFICATIONS) private readonly notifications?: NotificationsContract,
  ) {}

  // ─── Publicar (HU-025, HU-003, HU-024) ─────────────────────────────────────

  // HU-003 CA2: el frontend muestra la advertencia antes de enviar; create la vuelve a exigir.
  async previewLaborWarnings(dto: CreateOpportunityDto): Promise<LaborWarning[]> {
    return evaluateLaborWarnings(dto, await this.activeRules());
  }

  async create(userId: string, dto: CreateOpportunityDto, now = new Date()) {
    const publisherProfileId = await this.requirePublisher(userId);
    const categoryName = await this.assertBusinessRules(dto, now);
    const warnings = await this.requireAcknowledgement(dto);

    const opportunity = await this.prisma.opportunity.create({
      data: {
        publisherProfileId,
        type: dto.type,
        ...this.fieldsFor(dto, categoryName),
        laborWarningCodes: warnings.map((warning) => warning.code),
        laborWarningAcknowledgedAt: warnings.length > 0 ? now : null,
      },
      include: cardInclude,
    });
    return toOwnerView(opportunity);
  }

  // HU-023 CA2: edita una publicación activa o pausada. Se combina con lo guardado y se valida
  // como si se publicara de nuevo (mismas reglas, misma advertencia laboral).
  async update(userId: string, id: string, dto: UpdateOpportunityDto, now = new Date()) {
    const current = await this.findOwned(userId, id);
    if (current.status !== ACTIVE && current.status !== PAUSED) {
      throw new ConflictException({
        code: 'OPPORTUNITY_NOT_EDITABLE',
        message: 'Solo puedes editar publicaciones activas o pausadas',
      });
    }
    const merged = (await validationPipe.transform(
      { ...toEditableInput(current), ...dto, type: current.type },
      { type: 'body', metatype: CreateOpportunityDto },
    )) as CreateOpportunityDto;
    const categoryName = await this.assertBusinessRules(merged, now);
    const warnings = await this.requireAcknowledgement(merged, current.laborWarningCodes);

    const updated = await this.prisma.opportunity.update({
      where: { id },
      data: {
        ...this.fieldsFor(merged, categoryName),
        laborWarningCodes: warnings.map((warning) => warning.code),
        laborWarningAcknowledgedAt:
          warnings.length === 0
            ? null
            : sameCodes(warnings, current.laborWarningCodes)
              ? current.laborWarningAcknowledgedAt
              : now,
      },
      include: cardInclude,
    });
    // RF-03-08: si cambia el pago, la fecha o la cantidad de personas, se avisa a los interesados.
    if (
      current.paymentCop !== updated.paymentCop ||
      current.peopleNeeded !== updated.peopleNeeded ||
      current.scheduledAt?.getTime() !== updated.scheduledAt?.getTime() ||
      current.salaryMinCop !== updated.salaryMinCop ||
      current.salaryMaxCop !== updated.salaryMaxCop ||
      current.closesAt?.getTime() !== updated.closesAt?.getTime()
    ) {
      await this.notifyApplicants(updated, {
        type: 'OPPORTUNITY_UPDATED',
        title: 'Cambiaron las condiciones de una oportunidad',
      });
    }
    return toOwnerView(updated);
  }

  // RF-05-12: la dirección exacta la registra el publicador; solo la ven los trabajadores con
  // selección aceptada (engagements la lee con getForEngagement). Vacía la borra.
  async setExactAddress(userId: string, id: string, address: string) {
    const current = await this.findOwned(userId, id);
    if (current.status === CANCELLED || current.status === EXPIRED) throw invalidTransition();
    await this.prisma.opportunity.update({
      where: { id },
      data: { exactAddress: address.length > 0 ? address : null },
    });
  }

  // ─── Estados (HU-023 CA3, CA4) ─────────────────────────────────────────────

  pause(userId: string, id: string, reason: string) {
    return this.transition(userId, id, [ACTIVE], PAUSED, reason);
  }

  async resume(userId: string, id: string, now = new Date()) {
    const current = await this.findOwned(userId, id);
    if (current.status !== PAUSED) throw invalidTransition();
    if (isPast(current, now)) {
      throw new ConflictException({
        code: 'OPPORTUNITY_DATE_PASSED',
        message: 'La fecha de la publicación ya pasó; edítala antes de reactivarla',
      });
    }
    return this.transition(userId, id, [PAUSED], ACTIVE, null);
  }

  // RF-03-09: cerrar o cancelar avisa a interesados y seleccionados.
  async close(userId: string, id: string, reason: string) {
    const view = await this.transition(userId, id, [ACTIVE, PAUSED], CLOSED, reason);
    await this.notifyApplicants(view, {
      type: 'OPPORTUNITY_CANCELLED',
      title: 'Una oportunidad en la que te postulaste se cerró',
    });
    return view;
  }

  async cancel(userId: string, id: string, reason: string) {
    const view = await this.transition(userId, id, [ACTIVE, PAUSED, CLOSED], CANCELLED, reason);
    await this.notifyApplicants(view, {
      type: 'OPPORTUNITY_CANCELLED',
      title: 'Una oportunidad en la que te postulaste se canceló',
    });
    return view;
  }

  // RF-03-10 / RN-16: vence al llegar su fecha de realización o de cierre. Idempotente.
  async expireDue(now = new Date()) {
    const { count } = await this.prisma.opportunity.updateMany({
      where: {
        status: { in: [ACTIVE, PAUSED] },
        OR: [
          { type: { not: OpportunityType.FORMAL_JOB }, scheduledAt: { lte: now } },
          { type: OpportunityType.FORMAL_JOB, closesAt: { lte: now } },
        ],
      },
      data: { status: EXPIRED, closedAt: now },
    });
    return count;
  }

  // ─── Lecturas ──────────────────────────────────────────────────────────────

  // HU-009 y HU-010: solo activas y con fecha futura (RF-04-06), con filtros combinables.
  async listFeed(query: ListOpportunitiesQuery, now = new Date()) {
    const formal = query.mode === 'formal';
    const words = query.q ? normalizeSearch(query.q).split(' ').filter(Boolean) : [];
    const where: Prisma.OpportunityWhereInput = {
      status: ACTIVE,
      AND: words.map((word) => ({ searchText: { contains: word } })),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.zoneId && { zoneId: query.zoneId }),
      ...(formal
        ? {
            type: OpportunityType.FORMAL_JOB,
            closesAt: { gt: now },
            ...(query.modality && { modality: query.modality }),
            ...(query.schedule && { schedule: query.schedule }),
            // Rango que se cruza con el pedido: el salario máximo (o fijo) alcanza el mínimo pedido.
            ...(query.salaryMin !== undefined && {
              OR: [
                { salaryMaxCop: { gte: query.salaryMin } },
                { salaryMaxCop: null, salaryMinCop: { gte: query.salaryMin } },
              ],
            }),
            ...(query.salaryMax !== undefined && { salaryMinCop: { lte: query.salaryMax } }),
          }
        : {
            type:
              query.type && !isFormalType(query.type)
                ? query.type
                : { not: OpportunityType.FORMAL_JOB },
            scheduledAt: {
              gt: query.dateFrom && new Date(query.dateFrom) > now ? new Date(query.dateFrom) : now,
              ...(query.dateTo && { lte: new Date(query.dateTo) }),
            },
            ...((query.paymentMin !== undefined || query.paymentMax !== undefined) && {
              paymentCop: { gte: query.paymentMin, lte: query.paymentMax },
            }),
            ...(query.durationMax && { durationMinutes: { lte: query.durationMax } }),
          }),
    };
    const { page, pageSize, skip } = paging(query);
    const [total, rows] = await Promise.all([
      this.prisma.opportunity.count({ where }),
      this.prisma.opportunity.findMany({
        where,
        include: cardInclude,
        // Modo A: lo más reciente primero. Tareas: lo más próximo primero.
        orderBy: formal
          ? [{ createdAt: 'desc' }, { id: 'asc' }]
          : [{ scheduledAt: 'asc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      }),
    ]);
    const publishers = await this.profiles.getPublisherCards(
      rows.map((row) => row.publisherProfileId),
    );
    return {
      items: rows.map((row) => toPublicView(row, publishers.get(row.publisherProfileId))),
      page,
      pageSize,
      total,
    };
  }

  // HU-026: detalle público. Nunca incluye la dirección exacta ni el contacto (RF-02-07).
  async getPublic(id: string) {
    const row = await this.prisma.opportunity.findUnique({ where: { id }, include: cardInclude });
    if (!row || row.status === CANCELLED) throw notFound();
    const publishers = await this.profiles.getPublisherCards([row.publisherProfileId]);
    return toPublicView(row, publishers.get(row.publisherProfileId));
  }

  // Vista pública de varias oportunidades en una consulta (p. ej. "Mis postulaciones").
  // Incluye las canceladas para que el trabajador vea en qué terminó su postulación.
  async getPublicByIds(ids: string[]) {
    const rows = await this.prisma.opportunity.findMany({
      where: { id: { in: [...new Set(ids)] } },
      include: cardInclude,
    });
    const publishers = await this.profiles.getPublisherCards(
      rows.map((row) => row.publisherProfileId),
    );
    return new Map(
      rows.map((row) => [row.id, toPublicView(row, publishers.get(row.publisherProfileId))]),
    );
  }

  // HU-005 CA3: se puede postular solo a una oportunidad activa cuya fecha no ha pasado.
  isOpenForApplications(
    view: {
      status: OpportunityStatus;
      type: OpportunityType;
      scheduledAt: Date | null;
      closesAt: Date | null;
    },
    now = new Date(),
  ) {
    const date = isFormalType(view.type) ? view.closesAt : view.scheduledAt;
    return view.status === ACTIVE && date !== null && date > now;
  }

  // HU-023 CA1: "Mis publicaciones" con todos sus estados.
  async listMine(userId: string, query: PageQuery) {
    const publisherProfileId = await this.profiles.getPublisherIdForUser(userId);
    if (!publisherProfileId) return { items: [], page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0 };
    const where = { publisherProfileId };
    const { page, pageSize, skip } = paging(query);
    const [total, rows] = await Promise.all([
      this.prisma.opportunity.count({ where }),
      this.prisma.opportunity.findMany({
        where,
        include: cardInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      }),
    ]);
    // RF-03-07: contadores de interesados y aceptados.
    const counts = await this.applicationsContract()?.countForOpportunities(
      rows.map((row) => row.id),
    );
    return {
      items: rows.map((row) => ({
        ...toOwnerView(row),
        applicantsCount: counts?.get(row.id)?.applicants ?? 0,
        acceptedCount: counts?.get(row.id)?.accepted ?? 0,
      })),
      page,
      pageSize,
      total,
    };
  }

  async getOwn(userId: string, id: string) {
    return toOwnerView(await this.findOwned(userId, id));
  }

  // ─── Contrato para engagements ─────────────────────────────────────────────

  async getForEngagement(id: string): Promise<OpportunityForEngagement | null> {
    const row = await this.prisma.opportunity.findUnique({
      where: { id },
      include: { zone: { select: { id: true, name: true } } },
    });
    if (!row) return null;
    const publisherUserId = await this.profiles.getPublisherUserId(row.publisherProfileId);
    if (!publisherUserId) return null;
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      title: row.title,
      publisherProfileId: row.publisherProfileId,
      publisherUserId,
      peopleNeeded: row.peopleNeeded,
      scheduledAt: row.scheduledAt,
      durationMinutes: row.durationMinutes,
      zone: row.zone,
      exactAddress: row.exactAddress,
    };
  }

  async listIdsForPublisherUser(userId: string) {
    const publisherProfileId = await this.profiles.getPublisherIdForUser(userId);
    if (!publisherProfileId) return [];
    const rows = await this.prisma.opportunity.findMany({
      where: { publisherProfileId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async markFilled(id: string, now = new Date()) {
    await this.prisma.opportunity.updateMany({
      where: { id, status: ACTIVE },
      data: { status: CLOSED, statusReason: FILLED_REASON, closedAt: now },
    });
  }

  async reopenIfFilled(id: string, now = new Date()) {
    await this.prisma.opportunity.updateMany({
      where: {
        id,
        status: CLOSED,
        statusReason: FILLED_REASON,
        OR: [{ scheduledAt: { gt: now } }, { closesAt: { gt: now } }],
      },
      data: { status: ACTIVE, statusReason: null, closedAt: null },
    });
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  // null si el módulo de postulaciones no está cargado (p. ej. pruebas del módulo solo).
  private applicationsContract() {
    try {
      return this.moduleRef.get<ApplicationsContract>(APPLICATIONS, { strict: false });
    } catch {
      return null;
    }
  }

  // Avisa a quienes siguen en juego: no a rechazados ni a quienes se retiraron.
  private async notifyApplicants(
    opportunity: { id: string; title: string },
    event: Pick<NotifyInput, 'type' | 'title'>,
  ) {
    const applications = this.applicationsContract();
    if (!applications || !this.notifications) return;
    const applicants: ApplicantSummary[] = await applications.listForOpportunity(opportunity.id);
    await this.notifications.notifyMany(
      applicants
        .filter((applicant) => applicant.status !== 'REJECTED')
        .map((applicant) => ({
          ...event,
          userId: applicant.workerUserId,
          body: `"${opportunity.title}"`.slice(0, 500),
          link: '/mi-actividad',
          data: { opportunityId: opportunity.id },
        })),
    );
  }

  private async requirePublisher(userId: string) {
    if (!(await this.identity.isAccountActive(userId))) {
      throw new ForbiddenException('Confirma tu correo antes de publicar');
    }
    const publisherProfileId = await this.profiles.getPublisherIdForUser(userId);
    if (!publisherProfileId) {
      // RF-02-04 / HU-008 CA4: el frontend lleva a completar el perfil de publicador.
      throw new ForbiddenException({
        code: 'PUBLISHER_PROFILE_REQUIRED',
        message: 'Completa tu perfil de publicador antes de publicar',
      });
    }
    return publisherProfileId;
  }

  // Reglas que dependen de la fecha actual o de la base. Devuelve el nombre de la categoría.
  private async assertBusinessRules(dto: CreateOpportunityDto, now: Date) {
    const date = isFormalType(dto.type) ? dto.closesAt : dto.scheduledAt;
    const field = isFormalType(dto.type) ? 'closesAt' : 'scheduledAt';
    if (!date || new Date(date) <= now) {
      throw fieldError(field, 'La fecha debe ser posterior a la actual');
    }
    if (
      isFormalType(dto.type) &&
      dto.salaryMaxCop !== undefined &&
      dto.salaryMaxCop !== null &&
      dto.salaryMaxCop < (dto.salaryMinCop ?? 0)
    ) {
      throw fieldError('salaryMaxCop', 'El salario máximo no puede ser menor que el mínimo');
    }
    const [category, zoneOk] = await Promise.all([
      this.catalogs.getActiveCategory(dto.categoryId),
      this.catalogs.isActiveZone(dto.zoneId),
    ]);
    if (!category) throw fieldError('categoryId', 'Elige una categoría de la lista');
    if (!zoneOk) throw fieldError('zoneId', 'Elige una zona de Cali de la lista');
    return category.name;
  }

  // HU-003 CA2: si aplica alguna advertencia nueva, exige confirmar que se leyó.
  private async requireAcknowledgement(
    dto: CreateOpportunityDto,
    alreadyAcknowledged: string[] = [],
  ) {
    const warnings = evaluateLaborWarnings(dto, await this.activeRules());
    const pending = warnings.filter((warning) => !alreadyAcknowledged.includes(warning.code));
    if (pending.length > 0 && dto.acknowledgeLaborWarning !== true) {
      throw new ConflictException({
        code: 'LABOR_WARNING_REQUIRED',
        message: 'Lee la advertencia sobre relación laboral y confirma para publicar',
        warnings,
      });
    }
    return warnings;
  }

  private activeRules() {
    return this.prisma.laborWarningRule.findMany({
      where: { isActive: true },
      select: { code: true, message: true, params: true },
      orderBy: { id: 'asc' },
    });
  }

  private fieldsFor(dto: CreateOpportunityDto, categoryName: string) {
    const formal = isFormalType(dto.type);
    return {
      title: dto.title,
      description: dto.description,
      categoryId: dto.categoryId,
      zoneId: dto.zoneId,
      conditions: dto.conditions ? dto.conditions : null,
      peopleNeeded: formal ? null : (dto.peopleNeeded ?? null),
      paymentCop: formal ? null : (dto.paymentCop ?? null),
      scheduledAt: formal || !dto.scheduledAt ? null : new Date(dto.scheduledAt),
      durationMinutes: formal ? null : (dto.durationMinutes ?? null),
      salaryMinCop: formal ? (dto.salaryMinCop ?? null) : null,
      salaryMaxCop: formal ? (dto.salaryMaxCop ?? null) : null,
      modality: formal ? (dto.modality ?? null) : null,
      schedule: formal ? (dto.schedule ?? null) : null,
      experienceRequired: formal ? (dto.experienceRequired ?? null) : null,
      requirements: formal ? (dto.requirements ?? null) : null,
      closesAt: formal && dto.closesAt ? new Date(dto.closesAt) : null,
      searchText: buildSearchText([dto.title, dto.description, categoryName]),
    };
  }

  // 404 tanto si no existe como si es de otra persona (sin IDOR).
  private async findOwned(userId: string, id: string) {
    const publisherProfileId = await this.profiles.getPublisherIdForUser(userId);
    const row = await this.prisma.opportunity.findUnique({ where: { id }, include: cardInclude });
    if (!row || !publisherProfileId || row.publisherProfileId !== publisherProfileId)
      throw notFound();
    return row;
  }

  private async transition(
    userId: string,
    id: string,
    from: OpportunityStatus[],
    to: OpportunityStatus,
    reason: string | null,
  ) {
    await this.findOwned(userId, id);
    // Condicional: dos cambios simultáneos no pisan el estado del otro.
    const { count } = await this.prisma.opportunity.updateMany({
      where: { id, status: { in: from } },
      data: {
        status: to,
        statusReason: reason,
        closedAt: to === CLOSED || to === CANCELLED ? new Date() : null,
      },
    });
    if (count === 0) throw invalidTransition();
    return toOwnerView(await this.findOwned(userId, id));
  }
}

const isPast = (row: Opportunity, now: Date) => {
  const date = isFormalType(row.type) ? row.closesAt : row.scheduledAt;
  return !date || date <= now;
};

const sameCodes = (warnings: LaborWarning[], codes: string[]) =>
  warnings.length === codes.length && warnings.every((warning) => codes.includes(warning.code));

const paging = (query: { page?: number; pageSize?: number }) => {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  return { page, pageSize, skip: (page - 1) * pageSize };
};

// Lo guardado como entrada del DTO, para combinar con una edición parcial.
const toEditableInput = (row: Opportunity) => ({
  title: row.title,
  description: row.description,
  categoryId: row.categoryId,
  zoneId: row.zoneId,
  conditions: row.conditions ?? undefined,
  peopleNeeded: row.peopleNeeded ?? undefined,
  paymentCop: row.paymentCop ?? undefined,
  scheduledAt: row.scheduledAt?.toISOString(),
  durationMinutes: row.durationMinutes ?? undefined,
  salaryMinCop: row.salaryMinCop ?? undefined,
  salaryMaxCop: row.salaryMaxCop ?? undefined,
  modality: row.modality ?? undefined,
  schedule: row.schedule ?? undefined,
  experienceRequired: row.experienceRequired ?? undefined,
  requirements: row.requirements ?? undefined,
  closesAt: row.closesAt?.toISOString(),
});

const baseView = (row: OpportunityWithCatalogs) => ({
  id: row.id,
  type: row.type,
  status: row.status,
  title: row.title,
  description: row.description,
  category: row.category,
  zone: row.zone,
  conditions: row.conditions,
  peopleNeeded: row.peopleNeeded,
  paymentCop: row.paymentCop,
  scheduledAt: row.scheduledAt,
  durationMinutes: row.durationMinutes,
  salaryMinCop: row.salaryMinCop,
  salaryMaxCop: row.salaryMaxCop,
  modality: row.modality,
  schedule: row.schedule,
  experienceRequired: row.experienceRequired,
  requirements: row.requirements,
  closesAt: row.closesAt,
  createdAt: row.createdAt,
});

// Lista blanca explícita: sin dirección exacta, motivo interno ni datos de contacto.
const toPublicView = (row: OpportunityWithCatalogs, publisher?: PublisherCard) => ({
  ...baseView(row),
  publisher: publisher ?? null,
});

const toOwnerView = (row: OpportunityWithCatalogs) => ({
  ...baseView(row),
  statusReason: row.statusReason,
  exactAddress: row.exactAddress,
  laborWarningCodes: row.laborWarningCodes,
  laborWarningAcknowledgedAt: row.laborWarningAcknowledgedAt,
  updatedAt: row.updatedAt,
  closedAt: row.closedAt,
});
