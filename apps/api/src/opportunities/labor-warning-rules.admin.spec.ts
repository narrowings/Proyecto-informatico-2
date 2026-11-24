import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { LaborWarningRulesAdminService } from './labor-warning-rules.admin';

const actor = { userId: 'admin', ip: '10.0.0.1' };
const rules: Record<string, unknown> = {
  FULL_DAY: { code: 'FULL_DAY', message: 'm', params: { minMinutes: 480 }, isActive: true },
  SUBORDINATION_TERMS: {
    code: 'SUBORDINATION_TERMS',
    message: 'm',
    params: { terms: ['horario fijo'] },
    isActive: true,
  },
};

const setup = () => {
  const prisma = {
    laborWarningRule: {
      findMany: vi.fn().mockResolvedValue(Object.values(rules)),
      findUnique: vi.fn(async ({ where }) => rules[where.code] ?? null),
      update: vi.fn(async ({ where, data }) => ({ ...(rules[where.code] as object), ...data })),
    },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((operation: (tx: unknown) => unknown) =>
    operation(prisma),
  );
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new LaborWarningRulesAdminService(prisma as unknown as PrismaService, audit);
  return { prisma, audit, service };
};

describe('RF-03-05 Reglas de advertencia laboral administrables', () => {
  it('ajusta el umbral de jornada y lo audita', async () => {
    const { prisma, audit, service } = setup();
    await service.update('FULL_DAY', { params: { minMinutes: 420 } }, actor);
    expect(prisma.laborWarningRule.update.mock.calls[0][0].data).toEqual({
      params: { minMinutes: 420 },
    });
    expect(audit.record).toHaveBeenCalledWith(
      {
        actorUserId: 'admin',
        action: 'LABOR_RULE_UPDATED',
        targetType: 'labor_warning_rule',
        targetId: 'FULL_DAY',
        ip: '10.0.0.1',
        data: { changed: 'params', isActive: true },
      },
      prisma,
    );
  });

  it.each([
    [{ minMinutes: 30 }],
    [{ minMinutes: 480.5 }],
    [{ minMinutes: '480' }],
    [{ minMinutes: 480, otro: 1 }],
  ])('rechaza parámetros de jornada inválidos %j', async (params) => {
    const { prisma, service } = setup();
    await expect(service.update('FULL_DAY', { params }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.laborWarningRule.update).not.toHaveBeenCalled();
  });

  it('recorta las expresiones de subordinación y rechaza listas inválidas', async () => {
    const { prisma, service } = setup();
    await service.update(
      'SUBORDINATION_TERMS',
      { params: { terms: ['  bajo mis órdenes '] } },
      actor,
    );
    expect(prisma.laborWarningRule.update.mock.calls[0][0].data.params).toEqual({
      terms: ['bajo mis órdenes'],
    });
    for (const terms of [[], ['x'], 'horario', [1]]) {
      await expect(
        service.update('SUBORDINATION_TERMS', { params: { terms } }, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('un código que no existe en el código fuente responde 404 (no se crean reglas)', async () => {
    const { service } = setup();
    await expect(service.update('INVENTADA', { isActive: false }, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('desactivar o cambiar el texto queda auditado; sin cambios no hay evento', async () => {
    const { audit, service } = setup();
    await service.update('FULL_DAY', { isActive: true, params: { minMinutes: 480 } }, actor);
    expect(audit.record).not.toHaveBeenCalled();
    await service.update('FULL_DAY', { isActive: false, message: 'Texto nuevo aprobado' }, actor);
    expect(audit.record.mock.calls[0][0].data).toEqual({
      changed: 'message,isActive',
      isActive: false,
    });
  });
});
