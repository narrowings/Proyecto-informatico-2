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

  async listReports({
    status = ReportStatus.PENDING,
    targetType,
    page,
    pageSize,
  }: ListReportsQuery) {
    const reports = await this.prisma.report.findMany({
      where: { status, ...(targetType && { targetType }) },
      select: { targetType: true, targetId: true, reason: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const groups = new Map<
      string,
      {
        targetType: ReportTargetType;
        targetId: string;
        reportCount: number;
        reasons: Record<string, number>;
        firstReportedAt: Date;
        lastReportedAt: Date;
      }
    >();
    for (const report of reports) {
      const key = `${report.targetType}:${report.targetId}`;
      const group = groups.get(key);
      if (group) {
        group.reportCount++;
        group.reasons[report.reason] = (group.reasons[report.reason] ?? 0) + 1;
        group.lastReportedAt = report.createdAt;
      } else {
        groups.set(key, {
          targetType: report.targetType,
          targetId: report.targetId,
          reportCount: 1,
          reasons: { [report.reason]: 1 },
          firstReportedAt: report.createdAt,
          lastReportedAt: report.createdAt,
        });
      }
    }
    const ordered = [...groups.values()].sort(
      (left, right) =>
        right.reportCount - left.reportCount ||
        left.firstReportedAt.getTime() - right.firstReportedAt.getTime(),
    );
    const current = ordered.slice((page - 1) * pageSize, page * pageSize);
    const items = await Promise.all(
      current.map(async (group) => ({
        ...group,
        target:
          group.targetType === ReportTargetType.OPPORTUNITY
            ? await this.opportunities.getForModeration(group.targetId)
            : await this.userForModeration(group.targetId),
      })),
    );
    return { items, total: ordered.length, page, pageSize };
  }

  async reportDetail(targetType: ReportTargetType, targetId: string) {
    const reports = await this.prisma.report.findMany({
      where: { targetType, targetId },
      select: { reason: true, description: true, createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!reports.length) throw new NotFoundException('No encontramos reportes para este elemento');
    return { targetType, targetId, reportCount: reports.length, reports };
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
    await this.notify(result.publisherUserId, 'Tu publicación volvió a estar visible', reason);
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
          targetType: 'report',
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
    await this.notify(id, title, reason);
    return { id, status: to };
  }

  private async resolveReports(
    targetType: ReportTargetType,
    targetId: string,
    actorUserId: string,
    reason: string,
    tx: Parameters<typeof this.audit.record>[1],
  ) {
    await tx!.report.updateMany({
      where: { targetType, targetId, status: ReportStatus.PENDING },
      data: {
        status: ReportStatus.ACTIONED,
        resolution: reason,
        resolvedById: actorUserId,
        resolvedAt: new Date(),
      },
    });
  }

  private async notify(userId: string | null, title: string, reason: string) {
    if (!userId) return;
    const support =
      this.config.get<string>('SUPPORT_EMAIL') ||
      this.config.get<string>('MAIL_FROM') ||
      DEFAULT_MAIL_FROM;
    await this.notifications.notify({
      userId,
      type: 'MODERATION_NOTICE',
      title,
      body: `${reason}. Si crees que es un error, escríbenos a ${support} indicando tu correo de registro.`,
      link: '/mi-actividad',
    });
  }

  private async userForModeration(userId: string) {
    // Identity no expone un método de lectura por id con nombre y correo. Conservamos acceso seguro
    // para que la cola sea utilizable sin leer la tabla de identity desde este módulo.
    const access = await this.identity.getAccess(userId);
    return access ? { id: userId, ...access } : null;
  }
}
