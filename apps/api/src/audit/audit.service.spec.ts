import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

const setup = () => {
  const auditLog = {
    create: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(1),
    findMany: vi.fn().mockResolvedValue([{ id: 'a1' }]),
  };
  const prisma = {
    auditLog,
    $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  return { auditLog, prisma, service: new AuditService(prisma as unknown as PrismaService) };
};

describe('HU-038 Registro de auditoría', () => {
  it('CA1: guarda quién, qué, sobre qué, por qué y desde dónde', async () => {
    const { auditLog, service } = setup();
    await service.record({
      actorUserId: 'admin',
      action: 'OPPORTUNITY_HIDDEN',
      targetType: 'opportunity',
      targetId: 'o1',
      reason: 'Oferta engañosa',
      ip: '10.0.0.1',
      data: { reportes: 3 },
    });
    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'admin',
        action: 'OPPORTUNITY_HIDDEN',
        targetType: 'opportunity',
        targetId: 'o1',
        reason: 'Oferta engañosa',
        ip: '10.0.0.1',
        data: { reportes: 3 },
      },
    });
  });

  it('recorta los textos al tamaño de la columna sin partir caracteres', async () => {
    const { auditLog, service } = setup();
    await service.record({ actorUserId: null, action: 'ADMIN_LOGIN', reason: 'ñ'.repeat(600) });
    const { data } = auditLog.create.mock.calls[0][0];
    expect([...data.reason]).toHaveLength(500);
    expect(data.data).toEqual({});
    expect(data.targetId).toBeUndefined();
  });

  it('dentro de una transacción escribe con ese cliente', async () => {
    const { auditLog, service } = setup();
    const tx = { auditLog: { create: vi.fn().mockResolvedValue({}) } };
    await service.record({ actorUserId: 'a', action: 'USER_BLOCKED' }, tx as never);
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it('si no se puede guardar, falla (la acción auditada no debe seguir sin rastro)', async () => {
    const { auditLog, service } = setup();
    auditLog.create.mockRejectedValue(new Error('db caída'));
    await expect(service.record({ actorUserId: 'a', action: 'USER_BLOCKED' })).rejects.toThrow();
  });

  it('CA2: filtra por fechas, usuario y tipo, y pagina de lo más reciente a lo más antiguo', async () => {
    const { auditLog, service } = setup();
    const result = await service.list({
      page: 2,
      pageSize: 10,
      from: '2026-11-01T00:00:00Z',
      to: '2026-11-30T23:59:59Z',
      actorUserId: 'admin',
      action: 'USER_BLOCKED',
    });
    const where = {
      actorUserId: 'admin',
      action: 'USER_BLOCKED',
      createdAt: { gte: new Date('2026-11-01T00:00:00Z'), lte: new Date('2026-11-30T23:59:59Z') },
    };
    expect(auditLog.count).toHaveBeenCalledWith({ where });
    expect(auditLog.findMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 10,
    });
    expect(result).toEqual({ items: [{ id: 'a1' }], total: 1, page: 2, pageSize: 10 });
  });

  it('sin filtros consulta todo', async () => {
    const { auditLog, service } = setup();
    await service.list({ page: 1, pageSize: 20 });
    expect(auditLog.count).toHaveBeenCalledWith({ where: {} });
  });
});
