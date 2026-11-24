import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccountStatus,
  AuditAction,
  type Prisma,
  ReportStatus,
  ReportTargetType,
  UserRole,
} from '@prisma/client';
import { AUDIT, type AuditContract } from '../audit/audit.contract';
import { IdentityService } from '../identity/identity.service';
import { DEFAULT_MAIL_FROM } from '../mail/mail.service';
import { NOTIFICATIONS, type NotificationsContract } from '../notifications/notifications.contract';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { PrismaService } from '../prisma/prisma.service';
import { serializableTransaction } from '../prisma/serializable-transaction';
import { SessionService } from '../session/session.service';
import type { ListReportsQuery, ListUsersQuery } from './moderation.dto';

const conflict = (code: string, message: string) => new ConflictException({ code, message });
const cannotModerateAdmin = () =>
  new BadRequestException({
    code: 'CANNOT_MODERATE_ADMIN',
    message: 'No puedes moderar una cuenta administradora',
  });

@Injectable()
export class ModerationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OpportunitiesService) private readonly opportunities: OpportunitiesService,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AUDIT) private readonly audit: AuditContract,
    @Inject(NOTIFICATIONS) private readonly notifications: NotificationsContract,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  // HU-012 CA1: cola agrupada por elemento, la base agrupa y pagina. Más reportes primero y, a
  // igualdad, el más antiguo. No expone quién reportó.
  async listReports({
    status = ReportStatus.PENDING,
    targetType,
    page,
    pageSize,
  }: ListReportsQuery) {
    const where: Prisma.ReportWhereInput = { status, ...(targetType && { targetType }) };
    const [all, groups] = await Promise.all([
      this.prisma.report.groupBy({ by: ['targetType', 'targetId'], where }),
      this.prisma.report.groupBy({
        by: ['targetType', 'targetId'],
        where,
        _count: { _all: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
        orderBy: [{ _count: { targetId: 'desc' } }, { _min: { createdAt: 'asc' } }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const reasons = groups.length
      ? await this.prisma.report.groupBy({
          by: ['targetType', 'targetId', 'reason'],
          where: { ...where, targetId: { in: groups.map((group) => group.targetId) } },
          _count: { _all: true },
        })
      : [];
    const users = await this.identity.getUsersForModeration(
      groups.filter((group) => group.targetType === ReportTargetType.USER).map((g) => g.targetId),
    );
    const items = await Promise.all(
      groups.map(async (group) => ({
        targetType: group.targetType,
        targetId: group.targetId,
        reportCount: group._count._all,
        reasons: Object.fromEntries(
          reasons
            .filter((r) => r.targetType === group.targetType && r.targetId === group.targetId)
            .map((r) => [r.reason, r._count._all]),
        ),
        firstReportedAt: group._min.createdAt,
        lastReportedAt: group._max.createdAt,
        target: await this.targetSummary(group.targetType, group.targetId, users),
      })),
    );
    return { items, total: all.length, page, pageSize };
  }

  async reportDetail(targetType: ReportTargetType, targetId: string) {
    const reports = await this.prisma.report.findMany({
      where: { targetType, targetId },
      select: { reason: true, description: true, createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!reports.length) throw new NotFoundException('No encontramos reportes para este elemento');
    const users =
      targetType === ReportTargetType.USER
        ? await this.identity.getUsersForModeration([targetId])
        : new Map();
    const target = await this.targetSummary(targetType, targetId, users);
    return { targetType, targetId, target, reportCount: reports.length, reports };
  }

  async hideOpportunity(actorUserId: string, id: string, reason: string, ip?: string) {
    const result = await serializableTransaction(this.prisma, async (tx) => {
      const opportunity = await this.opportunities.hideByModeration(id, reason, new Date(), tx);
      if (!opportunity) return null;
      await this.resolveReports(ReportTargetType.OPPORTUNITY, id, actorUserId, reason, tx);
      await this.audit.record(
        {
          actorUserId,
          action: AuditAction.OPPORTUNITY_HIDDEN,
          targetType: 'opportunity',
          targetId: id,
          reason,
          ip,
        },
        tx,
      );
      return opportunity;
    });
    if (!result) {
      if (!(await this.opportunities.getForModeration(id)))
        throw new NotFoundException('Publicación no encontrada');
      throw conflict('ALREADY_HIDDEN', 'La publicación ya está oculta');
    }
    await this.notify(result.publisherUserId, 'Tu publicación fue ocultada', reason);
    return { id: result.id, hidden: true };
  }

  async unhideOpportunity(actorUserId: string, id: string, reason: string, ip?: string) {
    const result = await serializableTransaction(this.prisma, async (tx) => {
      const opportunity = await this.opportunities.unhideByModeration(id, tx);
      if (!opportunity) return null;
      await this.audit.record(
        {
          actorUserId,
          action: AuditAction.OPPORTUNITY_UNHIDDEN,
          targetType: 'opportunity',
          targetId: id,
          reason,
          ip,
        },
        tx,
      );
      return opportunity;
    });
    if (!result) {
      if (!(await this.opportunities.getForModeration(id)))
        throw new NotFoundException('Publicación no encontrada');
      throw conflict('NOT_HIDDEN', 'La publicación no está oculta');
    }
    await this.notify(
      result.publisherUserId,
      'Tu publicación volvió a estar visible',
      reason,
      false,
    );
    return { id: result.id, hidden: false };
  }

  listUsers(query: ListUsersQuery) {
    return this.identity.searchUsers(query);
  }

  async suspendUser(actorUserId: string, id: string, reason: string, ip?: string) {
    return this.changeUserStatus(
      actorUserId,
      id,
      [AccountStatus.ACTIVE],
      AccountStatus.SUSPENDED,
      AuditAction.USER_SUSPENDED,
      reason,
      ip,
    );
  }

  async blockUser(actorUserId: string, id: string, reason: string, ip?: string) {
    return this.changeUserStatus(
      actorUserId,
      id,
      [AccountStatus.ACTIVE, AccountStatus.SUSPENDED],
      AccountStatus.BLOCKED,
      AuditAction.USER_BLOCKED,
      reason,
      ip,
    );
  }

  async reactivateUser(actorUserId: string, id: string, reason: string, ip?: string) {
    return this.changeUserStatus(
      actorUserId,
      id,
      [AccountStatus.SUSPENDED, AccountStatus.BLOCKED],
      AccountStatus.ACTIVE,
      AuditAction.USER_REACTIVATED,
      reason,
      ip,
    );
  }

  async dismissReports(
    actorUserId: string,
    targetType: ReportTargetType,
    targetId: string,
    reason: string,
    ip?: string,
  ) {
    const count = await serializableTransaction(this.prisma, async (tx) => {
      const result = await tx.report.updateMany({
        where: { targetType, targetId, status: ReportStatus.PENDING },
        data: {
          status: ReportStatus.DISMISSED,
          resolution: reason,
          resolvedById: actorUserId,
          resolvedAt: new Date(),
        },
      });
      if (!result.count) return 0;
      await this.audit.record(
        {
          actorUserId,
          action: AuditAction.REPORT_DISMISSED,
          targetType: targetType.toLowerCase(),
          targetId,
          reason,
          ip,
          data: { reportes: result.count },
        },
        tx,
      );
      return result.count;
    });
    if (!count) throw new NotFoundException('No hay reportes pendientes para este elemento');
    return { dismissed: count };
  }

  private async changeUserStatus(
    actorUserId: string,
    id: string,
    from: AccountStatus[],
    to: AccountStatus,
    action: AuditAction,
    reason: string,
    ip?: string,
  ) {
    const access = await this.identity.getAccess(id);
    if (!access) throw new NotFoundException('Usuario no encontrado');
    if (id === actorUserId || access.role === UserRole.ADMIN) throw cannotModerateAdmin();
    const changed = await serializableTransaction(this.prisma, async (tx) => {
      const updated = await this.identity.setAccountStatus(id, from, to, tx);
      if (!updated) return false;
      if (to !== AccountStatus.ACTIVE) await this.sessions.revokeAllForUser(id, tx);
      if (to === AccountStatus.BLOCKED)
        await this.resolveReports(ReportTargetType.USER, id, actorUserId, reason, tx);
      await this.audit.record(
        { actorUserId, action, targetType: 'user', targetId: id, reason, ip },
        tx,
      );
      return true;
    });
    if (!changed)
      throw conflict(
        'INVALID_ACCOUNT_STATE',
        'La cuenta no está en un estado válido para esta acción',
      );
    const title =
      to === AccountStatus.ACTIVE
        ? 'Tu cuenta fue reactivada'
        : to === AccountStatus.BLOCKED
          ? 'Tu cuenta fue bloqueada'
          : 'Tu cuenta fue suspendida';
    await this.notify(id, title, reason, to !== AccountStatus.ACTIVE);
    return { id, status: to };
  }

  private async resolveReports(
    targetType: ReportTargetType,
    targetId: string,
    actorUserId: string,
    reason: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.report.updateMany({
      where: { targetType, targetId, status: ReportStatus.PENDING },
      data: {
        status: ReportStatus.ACTIONED,
        resolution: reason,
        resolvedById: actorUserId,
        resolvedAt: new Date(),
      },
    });
  }

  // HU-012 CA1: avisa al afectado con el motivo y cómo apelar (HU-036 aún no existe: por correo).
  // Va también por correo porque una cuenta suspendida o bloqueada no puede abrir su bandeja.
  private async notify(userId: string | null, title: string, reason: string, canAppeal = true) {
    if (!userId) return;
    const appeal = !canAppeal
      ? ''
      : ` Si crees que es un error, escríbenos a ${this.supportEmail()} indicando tu correo de registro.`;
    const motive = `Motivo: ${reason.replace(/[.\s]+$/, '')}.`;
    // body admite 500 caracteres: se recorta el motivo, nunca la forma de apelar.
    const room = 500 - appeal.length;
    await this.notifications.notify({
      userId,
      type: 'MODERATION_NOTICE',
      title,
      body:
        (motive.length > room ? `${[...motive].slice(0, room - 1).join('')}…` : motive) + appeal,
      link: '/mi-actividad',
    });
  }

  // Solo la dirección: MAIL_FROM suele venir como "Nombre <correo>".
  private supportEmail() {
    const configured =
      this.config.get<string>('SUPPORT_EMAIL')?.trim() ||
      this.config.get<string>('MAIL_FROM')?.trim() ||
      DEFAULT_MAIL_FROM;
    return configured.match(/<([^>]+)>/)?.[1] ?? configured;
  }

  private async targetSummary(
    targetType: ReportTargetType,
    targetId: string,
    users: Map<string, unknown>,
  ) {
    if (targetType === ReportTargetType.OPPORTUNITY) {
      return this.opportunities.getForModeration(targetId);
    }
    return users.get(targetId) ?? null;
  }
}
