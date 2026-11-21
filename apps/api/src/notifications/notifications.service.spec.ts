import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IdentityService } from '../identity/identity.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotifyInput } from './notifications.contract';
import { EMAIL_NOTIFICATION_TYPES, NotificationsService } from './notifications.service';

const date = new Date('2026-11-20T14:00:00Z');
const event: NotifyInput = {
  userId: 'u',
  type: 'JOB_COMPLETED',
  title: 'Trabajo completado',
  body: 'Ya puedes calificar',
  link: '/mi-actividad',
  data: { recursoId: 't' },
};
const record = { ...event, id: 'n', readAt: null, emailedAt: null, createdAt: date };
const flushScheduledEmail = () => new Promise<void>((resolve) => setImmediate(resolve));

function setup() {
  const notification = {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    update: vi.fn().mockResolvedValue({}),
    createManyAndReturn: vi.fn(({ data }: { data: NotifyInput[] }) =>
      Promise.resolve(data.map((notification, index) => ({ ...notification, id: `n${index}` }))),
    ),
  };
  const transaction = vi.fn((operations: Promise<unknown>[]) => Promise.all(operations));
  const identity = {
    getNotificationRecipient: vi.fn().mockResolvedValue({ name: 'Ana', email: 'ana@example.com' }),
  };
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  const service = new NotificationsService(
    { notification, $transaction: transaction } as unknown as PrismaService,
    identity as unknown as IdentityService,
    mailer,
    new ConfigService({ WEB_URL: 'https://example.com/' }),
  );
  return { service, notification, transaction, identity, mailer };
}

afterEach(() => vi.restoreAllMocks());

describe('HU-014 CA5 y RF-07-07 Bandeja', () => {
  it('pagina en orden descendente y expone los campos públicos y el total de pendientes', async () => {
    const { service, notification } = setup();
    notification.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    notification.findMany.mockResolvedValue([{ ...record, readAt: date, link: '//example.com' }]);
    await expect(service.listOwn('u', { page: 2, pageSize: 2 })).resolves.toEqual({
      items: [
        {
          id: 'n',
          type: 'JOB_COMPLETED',
          title: event.title,
          body: event.body,
          link: null,
          read: true,
          createdAt: date,
        },
      ],
      total: 3,
      unread: 2,
      page: 2,
      pageSize: 2,
    });
    expect(notification.findMany).toHaveBeenCalledExactlyOnceWith({
      where: { userId: 'u' },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        link: true,
        readAt: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 2,
      take: 2,
    });
    expect(notification.count.mock.calls.map(([query]) => query)).toEqual([
      { where: { userId: 'u' } },
      { where: { userId: 'u', readAt: null } },
    ]);
  });

  it('consulta una sola vez el contador de las notificaciones propias no leídas', async () => {
    const { service, notification, transaction } = setup();
    notification.count.mockResolvedValue(4);
    await expect(service.getUnreadCount('u')).resolves.toEqual({ unread: 4 });
    expect(notification.count).toHaveBeenCalledExactlyOnceWith({
      where: { userId: 'u', readAt: null },
    });
    expect(notification.findMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('marca como leída la notificación propia y conserva la fecha al repetir la operación', async () => {
    const { service, notification } = setup();
    let readAt: Date | null = null;
    notification.findUnique.mockResolvedValue({ id: 'n', link: '/mi-actividad' });
    notification.updateMany.mockImplementation(({ where, data }) => {
      if (where.id !== 'n' || where.userId !== 'u' || where.readAt !== readAt)
        return Promise.resolve({ count: 0 });
      readAt = data.readAt;
      return Promise.resolve({ count: 1 });
    });

    await expect(service.markAsRead('u', 'n')).resolves.toEqual({ id: 'n', link: '/mi-actividad' });
    const firstReadAt = readAt;
    expect(firstReadAt).toBeInstanceOf(Date);
    await expect(service.markAsRead('u', 'n')).resolves.toEqual({ id: 'n', link: '/mi-actividad' });
    expect(readAt).toBe(firstReadAt);
    expect(notification.findUnique).toHaveBeenCalledWith({
      where: { id: 'n', userId: 'u' },
      select: { id: true, link: true },
    });
  });

  it.each(['ajena', 'inexistente'])('responde 404 para una notificación %s', async (id) => {
    const { service, notification } = setup();
    await expect(service.markAsRead('u', id)).rejects.toMatchObject({
      status: 404,
      response: { code: 'NOTIFICATION_NOT_FOUND' },
    });
    expect(notification.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { id, userId: 'u', readAt: null },
      data: { readAt: expect.any(Date) },
    });
    expect(notification.findUnique).toHaveBeenCalledExactlyOnceWith({
      where: { id, userId: 'u' },
      select: { id: true, link: true },
    });
  });

  it('marca todas las notificaciones no leídas del usuario y devuelve el total actualizado', async () => {
    const { service, notification } = setup();
    notification.updateMany.mockResolvedValue({ count: 3 });
    await expect(service.markAllAsRead('u')).resolves.toEqual({ updated: 3 });
    expect(notification.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { userId: 'u', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});

describe('RF-07-07 Guardado seguro', () => {
  it.each([
    'https://x.com',
    '//x.com',
    'javascript:alert(1)',
    '/\\x.com',
    '/\t/x.com',
    '/ruta?url=https://x.com',
    '/' + 'x'.repeat(300),
  ])('guarda como nulo el enlace inválido %j', async (link) => {
    const { service, notification } = setup();
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await service.notify({ ...event, type: 'RATING_AVAILABLE', link });
    expect(notification.createManyAndReturn).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        data: [expect.objectContaining({ link: null })],
      }),
    );
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      'Se descartó un enlace de notificación que no es una ruta interna válida',
    );
  });

  it('recorta título y cuerpo, conserva la ruta interna y mantiene los datos del contrato', async () => {
    const { service, notification } = setup();
    const input = {
      ...event,
      type: 'RATING_AVAILABLE' as const,
      title: 't'.repeat(161),
      body: 'b'.repeat(501),
    };
    await service.notify(input);
    expect(notification.createManyAndReturn).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        data: [{ ...input, title: 't'.repeat(160), body: 'b'.repeat(500) }],
      }),
    );
  });

  it('contiene un fallo de persistencia y no intenta enviar el correo', async () => {
    const { service, notification, mailer } = setup();
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    notification.createManyAndReturn.mockRejectedValueOnce(new Error('Sin conexión'));
    await expect(service.notifyMany([event])).resolves.toBeUndefined();
    await flushScheduledEmail();
    expect(error).toHaveBeenCalledExactlyOnceWith('No se pudieron guardar las notificaciones');
    expect(mailer.send).not.toHaveBeenCalled();
  });
});

describe('HU-014 CA1–CA4 y RF-07-06 Avisos por correo', () => {
  it('envía correo solo para los ocho tipos indicados y guarda un registro para todos', async () => {
    const { service, notification, identity, mailer } = setup();
    const emailTypes: NotificationType[] = [
      'NEW_APPLICANT',
      'SELECTION_RECEIVED',
      'SELECTION_ACCEPTED',
      'APPLICATION_STATUS_CHANGED',
      'OPPORTUNITY_UPDATED',
      'OPPORTUNITY_CANCELLED',
      'JOB_COMPLETED',
      'JOB_CANCELLED',
    ];
    const inputs = Object.values(NotificationType).map((type) => ({ ...event, type, title: type }));
    await service.notifyMany(inputs);
    expect(notification.createManyAndReturn).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        data: inputs,
      }),
    );
    expect(EMAIL_NOTIFICATION_TYPES).toEqual(new Set(emailTypes));
    expect(mailer.send).not.toHaveBeenCalled();
    await flushScheduledEmail();
    expect(mailer.send.mock.calls.map(([email]) => email.subject).sort()).toEqual(
      emailTypes.sort(),
    );
    expect(identity.getNotificationRecipient).toHaveBeenCalledTimes(emailTypes.length);
    expect(notification.update).toHaveBeenCalledTimes(emailTypes.length);
  });

  it('programa el correo después de persistir y marca emailedAt después de que termina el envío', async () => {
    const { service, notification, identity, mailer } = setup();
    let finishSending: (() => void) | undefined;
    mailer.send.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSending = resolve;
      }),
    );
    await service.notify(event);
    expect(identity.getNotificationRecipient).not.toHaveBeenCalled();
    await flushScheduledEmail();
    expect(mailer.send).toHaveBeenCalledExactlyOnceWith({
      to: 'ana@example.com',
      name: 'Ana',
      subject: event.title,
      text: event.body,
      link: 'https://example.com/mi-actividad',
    });
    expect(notification.update).not.toHaveBeenCalled();
    finishSending?.();
    await flushScheduledEmail();
    expect(notification.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: 'n0' },
      data: { emailedAt: expect.any(Date) },
    });
  });

  it.each(['inactiva', 'inexistente'])('omite el correo si la cuenta está %s', async () => {
    const { service, identity, notification, mailer } = setup();
    identity.getNotificationRecipient.mockResolvedValue(null);
    await service.notify(event);
    await flushScheduledEmail();
    expect(identity.getNotificationRecipient).toHaveBeenCalledExactlyOnceWith('u');
    expect(notification.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(mailer.send).not.toHaveBeenCalled();
    expect(notification.update).not.toHaveBeenCalled();
  });

  it('usa el enlace alternativo si falta la ruta y continúa con el lote si un envío falla', async () => {
    const { service, notification, mailer } = setup();
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    mailer.send.mockRejectedValueOnce(new Error('Fallo para ana@example.com'));
    await expect(
      service.notifyMany([
        { ...event, link: undefined },
        { ...event, link: '/mi-actividad/trabajos' },
      ]),
    ).resolves.toBeUndefined();
    await flushScheduledEmail();
    expect(mailer.send).toHaveBeenCalledTimes(2);
    expect(mailer.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ link: 'https://example.com/mi-actividad' }),
    );
    expect(mailer.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ link: 'https://example.com/mi-actividad/trabajos' }),
    );
    expect(error).toHaveBeenCalledExactlyOnceWith('No se pudo procesar el correo de notificación');
    expect(notification.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: 'n1' },
      data: { emailedAt: expect.any(Date) },
    });
  });
});
