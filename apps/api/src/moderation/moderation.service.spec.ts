import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { IdentityService } from '../identity/identity.service';
import type { OpportunitiesService } from '../opportunities/opportunities.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { SessionService } from '../session/session.service';
import { ModerationService } from './moderation.service';

const OPP = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const reason = 'Ofrece pagos por adelantado, típico de fraude.';

type Target = { id: string; title: string; publisherUserId: string };

const setup = (env: Record<string, string> = { SUPPORT_EMAIL: 'soporte@red.co' }) => {
  const order: string[] = [];
  const tx = {
    report: {
      updateMany: vi.fn().mockImplementation(async () => {
        order.push('reportes');
        return { count: 2 };
      }),
    },
  };
  const prisma = {
    report: { groupBy: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn((operation: (client: unknown) => unknown) => operation(tx)),
  };
  const opportunities = {
    hideByModeration: vi.fn().mockImplementation(async (): Promise<Target | null> => {
      order.push('ocultar');
      return { id: OPP, title: 'Pintar', publisherUserId: 'publicador' };
    }),
    unhideByModeration: vi
      .fn()
      .mockResolvedValue({ id: OPP, title: 'Pintar', publisherUserId: 'publicador' }),
    getForModeration: vi.fn().mockResolvedValue({ id: OPP, title: 'Pintar' }),
  };
  const identity = {
    getAccess: vi.fn().mockResolvedValue({ role: 'USER', status: 'ACTIVE' }),
    setAccountStatus: vi.fn().mockImplementation(async () => {
      order.push('estado');
      return true;
    }),
    searchUsers: vi.fn().mockResolvedValue({ items: [] }),
    getUsersForModeration: vi
      .fn()
      .mockResolvedValue(
        new Map([
          [USER, { id: USER, name: 'Beto', email: 'beto@x.co', status: 'ACTIVE', role: 'USER' }],
        ]),
      ),
  };
  const sessions = {
    revokeAllForUser: vi.fn().mockImplementation(async () => {
      order.push('sesiones');
    }),
  };
  const audit = {
    record: vi.fn().mockImplementation(async () => {
      order.push('auditoria');
    }),
  };
  const notifications = {
    notify: vi.fn().mockImplementation(async () => {
      order.push('aviso');
    }),
    notifyMany: vi.fn(),
  };
  const service = new ModerationService(
    prisma as unknown as PrismaService,
    opportunities as unknown as OpportunitiesService,
    identity as unknown as IdentityService,
    sessions as unknown as SessionService,
    audit,
    notifications,
    new ConfigService(env),
  );
  return { service, prisma, tx, opportunities, identity, sessions, audit, notifications, order };
};

describe('HU-012 CA1 Ocultar publicaciones', () => {
  it('oculta, resuelve los reportes y audita en la transacción; avisa después', async () => {
    const { service, tx, audit, notifications, order } = setup();
    await expect(service.hideOpportunity('admin', OPP, reason, '10.0.0.1')).resolves.toEqual({
      id: OPP,
      hidden: true,
    });
    expect(order).toEqual(['ocultar', 'reportes', 'auditoria', 'aviso']);
    expect(tx.report.updateMany).toHaveBeenCalledWith({
      where: { targetType: 'OPPORTUNITY', targetId: OPP, status: 'PENDING' },
      data: expect.objectContaining({
        status: 'ACTIONED',
        resolution: reason,
        resolvedById: 'admin',
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      {
        actorUserId: 'admin',
        action: 'OPPORTUNITY_HIDDEN',
        targetType: 'opportunity',
        targetId: OPP,
        reason,
        ip: '10.0.0.1',
      },
      tx,
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'publicador', type: 'MODERATION_NOTICE' }),
    );
  });

  it('si la auditoría falla no hay aviso y el error se propaga', async () => {
    const { service, audit, notifications } = setup();
    audit.record.mockRejectedValue(new Error('db'));
    await expect(service.hideOpportunity('admin', OPP, reason)).rejects.toThrow('db');
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('ya oculta: 409; inexistente: 404; sin auditoría ni aviso', async () => {
    const { service, opportunities, audit, notifications } = setup();
    opportunities.hideByModeration.mockResolvedValue(null);
    await expect(service.hideOpportunity('admin', OPP, reason)).rejects.toMatchObject({
      response: { code: 'ALREADY_HIDDEN' },
    });
    opportunities.getForModeration.mockResolvedValue(null);
    await expect(service.hideOpportunity('admin', OPP, reason)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.record).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('volver a mostrar audita y avisa; si no estaba oculta responde 409', async () => {
    const { service, audit, opportunities } = setup();
    await expect(service.unhideOpportunity('admin', OPP, reason)).resolves.toEqual({
      id: OPP,
      hidden: false,
    });
    expect(audit.record.mock.calls[0][0]).toMatchObject({ action: 'OPPORTUNITY_UNHIDDEN' });
    opportunities.unhideByModeration.mockResolvedValue(null);
    await expect(service.unhideOpportunity('admin', OPP, reason)).rejects.toMatchObject({
      response: { code: 'NOT_HIDDEN' },
    });
  });
});

describe('HU-012 CA1 Aviso al afectado', () => {
  it('incluye el motivo y el correo de soporte, y no supera 500 caracteres', async () => {
    const { service, notifications } = setup();
    await service.hideOpportunity('admin', OPP, 'x'.repeat(500));
    const { body } = notifications.notify.mock.calls[0][0];
    expect([...body].length).toBeLessThanOrEqual(500);
    expect(body).toContain('soporte@red.co');
    expect(body.startsWith('Motivo: xxx')).toBe(true);
  });

  it('sin SUPPORT_EMAIL usa solo la dirección de MAIL_FROM', async () => {
    const { service, notifications } = setup({ MAIL_FROM: 'Red <ayuda@red.co>' });
    await service.hideOpportunity('admin', OPP, reason);
    expect(notifications.notify.mock.calls[0][0].body).toBe(
      'Motivo: Ofrece pagos por adelantado, típico de fraude. Si crees que es un error, escríbenos a ayuda@red.co indicando tu correo de registro.',
    );
  });
});

describe('HU-012 CA3 Gestión de usuarios', () => {
  it('bloquear: cambia el estado, revoca sesiones, resuelve reportes y audita en una transacción', async () => {
    const { service, identity, sessions, audit, tx, order } = setup();
    await expect(service.blockUser('admin', USER, reason, '10.0.0.1')).resolves.toEqual({
      id: USER,
      status: 'BLOCKED',
    });
    expect(identity.setAccountStatus).toHaveBeenCalledWith(
      USER,
      ['ACTIVE', 'SUSPENDED'],
      'BLOCKED',
      tx,
    );
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(USER, tx);
    expect(audit.record.mock.calls[0][0]).toMatchObject({ action: 'USER_BLOCKED', targetId: USER });
    expect(order).toEqual(['estado', 'sesiones', 'reportes', 'auditoria', 'aviso']);
  });

  it('suspender revoca sesiones pero no resuelve reportes', async () => {
    const { service, identity, sessions, tx } = setup();
    await service.suspendUser('admin', USER, reason);
    expect(identity.setAccountStatus).toHaveBeenCalledWith(USER, ['ACTIVE'], 'SUSPENDED', tx);
    expect(sessions.revokeAllForUser).toHaveBeenCalled();
    expect(tx.report.updateMany).not.toHaveBeenCalled();
  });

  it('reactivar no revoca sesiones y avisa', async () => {
    const { service, identity, sessions, notifications, tx } = setup();
    await service.reactivateUser('admin', USER, reason);
    expect(identity.setAccountStatus).toHaveBeenCalledWith(
      USER,
      ['SUSPENDED', 'BLOCKED'],
      'ACTIVE',
      tx,
    );
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    expect(notifications.notify.mock.calls[0][0]).toMatchObject({
      title: 'Tu cuenta fue reactivada',
      body: `Motivo: ${reason}`,
    });
  });

  it('un estado que no corresponde responde 409 sin auditar', async () => {
    const { service, identity, audit, notifications } = setup();
    identity.setAccountStatus.mockResolvedValue(false);
    await expect(service.reactivateUser('admin', USER, reason)).rejects.toMatchObject({
      response: { code: 'INVALID_ACCOUNT_STATE' },
    });
    expect(audit.record).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('no se modera a un administrador ni a uno mismo; un usuario inexistente es 404', async () => {
    const { service, identity } = setup();
    identity.getAccess.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });
    await expect(service.blockUser('admin', USER, reason)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.suspendUser(USER, USER, reason)).rejects.toMatchObject({
      response: { code: 'CANNOT_MODERATE_ADMIN' },
    });
    identity.getAccess.mockResolvedValueOnce(null);
    await expect(service.blockUser('admin', USER, reason)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(identity.setAccountStatus).not.toHaveBeenCalled();
  });
});

describe('HU-012 CA1 Cola de reportes', () => {
  it('agrupa y pagina en la base, cuenta motivos y resume el elemento sin exponer a quien reportó', async () => {
    const { service, prisma, identity } = setup();
    const first = new Date('2026-11-01T00:00:00Z');
    const last = new Date('2026-11-02T00:00:00Z');
    prisma.report.groupBy
      .mockResolvedValueOnce([{}, {}, {}])
      .mockResolvedValueOnce([
        {
          targetType: 'USER',
          targetId: USER,
          _count: { _all: 2 },
          _min: { createdAt: first },
          _max: { createdAt: last },
        },
        {
          targetType: 'OPPORTUNITY',
          targetId: OPP,
          _count: { _all: 1 },
          _min: { createdAt: first },
          _max: { createdAt: first },
        },
      ])
      .mockResolvedValueOnce([
        { targetType: 'USER', targetId: USER, reason: 'FRAUD', _count: { _all: 1 } },
        { targetType: 'USER', targetId: USER, reason: 'SPAM', _count: { _all: 1 } },
        { targetType: 'OPPORTUNITY', targetId: OPP, reason: 'SPAM', _count: { _all: 1 } },
      ]);
    const result = await service.listReports({ page: 2, pageSize: 2 });
    expect(prisma.report.groupBy.mock.calls[1][0]).toMatchObject({
      where: { status: 'PENDING' },
      orderBy: [{ _count: { targetId: 'desc' } }, { _min: { createdAt: 'asc' } }],
      skip: 2,
      take: 2,
    });
    expect(identity.getUsersForModeration).toHaveBeenCalledWith([USER]);
    expect(result).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(result.items[0]).toEqual({
      targetType: 'USER',
      targetId: USER,
      reportCount: 2,
      reasons: { FRAUD: 1, SPAM: 1 },
      firstReportedAt: first,
      lastReportedAt: last,
      target: { id: USER, name: 'Beto', email: 'beto@x.co', status: 'ACTIVE', role: 'USER' },
    });
    expect(result.items[1]).toMatchObject({ reasons: { SPAM: 1 }, target: { id: OPP } });
    expect(JSON.stringify(result)).not.toContain('reporter');
  });

  it('el detalle no muestra quién reportó y sin reportes responde 404', async () => {
    const { service, prisma } = setup();
    prisma.report.findMany.mockResolvedValueOnce([
      {
        reason: 'OTHER',
        description: 'Pide dinero antes',
        createdAt: new Date(),
        status: 'PENDING',
      },
    ]);
    const detail = await service.reportDetail('OPPORTUNITY', OPP);
    expect(prisma.report.findMany.mock.calls[0][0].select).not.toHaveProperty('reporterUserId');
    expect(detail).toMatchObject({ reportCount: 1, target: { id: OPP } });
    prisma.report.findMany.mockResolvedValueOnce([]);
    await expect(service.reportDetail('USER', USER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('descartar marca los pendientes como DISMISSED y audita; sin pendientes es 404', async () => {
    const { service, tx, audit } = setup();
    await expect(service.dismissReports('admin', 'USER', USER, reason)).resolves.toEqual({
      dismissed: 2,
    });
    expect(tx.report.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'DISMISSED' });
    expect(audit.record.mock.calls[0][0]).toMatchObject({
      action: 'REPORT_DISMISSED',
      targetType: 'user',
      targetId: USER,
      data: { reportes: 2 },
    });
    tx.report.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.dismissReports('admin', 'USER', USER, reason)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
