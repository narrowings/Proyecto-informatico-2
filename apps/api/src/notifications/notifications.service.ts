import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type Notification, type NotificationType } from '@prisma/client';
import type { PaginationDto } from '../common/http/pagination.dto';
import { IdentityService } from '../identity/identity.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationMailer } from './notification-mailer';
import type { NotificationsContract, NotifyInput } from './notifications.contract';

export const EMAIL_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
  'NEW_APPLICANT',
  'SELECTION_RECEIVED',
  'SELECTION_ACCEPTED',
  'APPLICATION_STATUS_CHANGED',
  'OPPORTUNITY_UPDATED',
  'OPPORTUNITY_CANCELLED',
  'JOB_COMPLETED',
  'JOB_CANCELLED',
  'MODERATION_NOTICE',
]);

const inboxFields = {
  id: true,
  type: true,
  title: true,
  body: true,
  link: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

const emailFields = {
  id: true,
  userId: true,
  type: true,
  title: true,
  body: true,
  link: true,
} satisfies Prisma.NotificationSelect;

type EmailNotification = Pick<Notification, keyof typeof emailFields>;

function isInternalLink(link: string | null | undefined): link is string {
  return (
    typeof link === 'string' &&
    link.length <= 300 &&
    link.startsWith('/') &&
    !link.startsWith('//') &&
    !link.includes('://') &&
    !/[\\\r\n\t]/.test(link)
  );
}

function truncate(text: string, maxLength: number) {
  return text.length <= maxLength ? text : [...text].slice(0, maxLength).join('');
}

@Injectable()
export class NotificationsService implements NotificationsContract {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(NotificationMailer) private readonly mailer: NotificationMailer,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async listOwn(userId: string, { page, pageSize }: PaginationDto) {
    const where = { userId };
    const [rows, total, unread] = await this.prisma.$transaction(
      [
        this.prisma.notification.findMany({
          where,
          select: inboxFields,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.notification.count({ where }),
        this.prisma.notification.count({ where: { userId, readAt: null } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    const items = rows.map(({ id, type, title, body, link, readAt, createdAt }) => ({
      id,
      type,
      title,
      body,
      link: isInternalLink(link) ? link : null,
      read: readAt !== null,
      createdAt,
    }));
    return { items, total, unread, page, pageSize };
  }

  async getUnreadCount(userId: string) {
    const unread = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { unread };
  }

  async markAsRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    const notification = await this.prisma.notification.findUnique({
      where: { id, userId },
      select: { id: true, link: true },
    });
    if (!notification) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'No encontramos la notificación',
      });
    }
    return {
      id: notification.id,
      link: isInternalLink(notification.link) ? notification.link : null,
    };
  }

  async markAllAsRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  notify(input: NotifyInput) {
    return this.notifyMany([input]);
  }

  async notifyMany(inputs: NotifyInput[]) {
    if (!inputs.length) return;
    try {
      const data = inputs.map(({ userId, type, title, body, link, data }) => {
        const internalLink = isInternalLink(link) ? link : null;
        if (link !== undefined && internalLink === null) {
          this.logger.warn(
            'Se descartó un enlace de notificación que no es una ruta interna válida',
          );
        }
        return {
          userId,
          type,
          title: truncate(title, 160),
          body: truncate(body, 500),
          link: internalLink,
          data,
        };
      });
      const notifications = await this.prisma.notification.createManyAndReturn({
        data,
        select: emailFields,
      });
      const pending = notifications.filter(({ type }) => EMAIL_NOTIFICATION_TYPES.has(type));
      if (pending.length) {
        setImmediate(() => void this.sendEmails(pending));
      }
    } catch {
      this.logger.error('No se pudieron guardar las notificaciones');
    }
  }

  private async sendEmails(notifications: EmailNotification[]) {
    for (const { id, userId, title, body, link } of notifications) {
      try {
        const recipient = await this.identity.getNotificationRecipient(userId);
        if (!recipient) continue;
        const webUrl = this.config
          .get<string>('WEB_URL', 'http://localhost:3000')
          .replace(/\/+$/, '');
        await this.mailer.send({
          to: recipient.email,
          name: recipient.name,
          subject: title,
          text: body,
          link: `${webUrl}${link ?? '/mi-actividad'}`,
        });
        await this.prisma.notification.update({ where: { id }, data: { emailedAt: new Date() } });
      } catch {
        this.logger.error('No se pudo procesar el correo de notificación');
      }
    }
  }
}
