import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, ReportReason, ReportTargetType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ReportsService } from './reports.service';

const reporterId = '6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f';
const profileId = '7f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f';

const setup = () => {
  const prisma = { report: { create: vi.fn(), findMany: vi.fn() } };
  const opportunities = { getPublic: vi.fn() };
  const profiles = { getPublisherUserId: vi.fn() };
  const workers = { getWorkerUserId: vi.fn() };
  return {
    prisma,
    opportunities,
    profiles,
    workers,
    service: new ReportsService(
      prisma as never,
      opportunities as never,
      profiles as never,
      workers as never,
    ),
  };
};

describe('HU-019 Reportes de la comunidad', () => {
  it('crea un reporte de oportunidad y devuelve el agradecimiento sin datos del reportado', async () => {
    const { service, prisma, opportunities, profiles } = setup();
    opportunities.getPublic.mockResolvedValue({ publisher: { id: profileId } });
    profiles.getPublisherUserId.mockResolvedValue('otra-persona');
    prisma.report.create.mockResolvedValue({ id: 'reporte-1' });

    await expect(
      service.create(reporterId, {
        targetType: ReportTargetType.OPPORTUNITY,
        targetId: profileId,
        reason: ReportReason.SPAM,
      }),
    ).resolves.toEqual({
      id: 'reporte-1',
      message: 'Gracias por tu reporte. Nuestro equipo lo revisará.',
    });
  });

  it('rechaza reportarse a sí mismo y reportar una publicación propia', async () => {
    const { service, opportunities, profiles, workers } = setup();
    opportunities.getPublic.mockResolvedValue({ publisher: { id: profileId } });
    profiles.getPublisherUserId.mockResolvedValue(reporterId);
    await expect(
      service.create(reporterId, {
        targetType: ReportTargetType.OPPORTUNITY,
        targetId: profileId,
        reason: ReportReason.SPAM,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    workers.getWorkerUserId.mockResolvedValue(reporterId);
    await expect(
      service.create(reporterId, {
        targetType: ReportTargetType.USER,
        targetId: profileId,
        profileKind: 'WORKER',
        reason: ReportReason.SPAM,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resuelve el perfil de trabajador y guarda su userId como destino', async () => {
    const { service, prisma, workers } = setup();
    workers.getWorkerUserId.mockResolvedValue('usuario-reportado');
    prisma.report.create.mockResolvedValue({ id: 'reporte-1' });
    await service.create(reporterId, {
      targetType: ReportTargetType.USER,
      targetId: profileId,
      profileKind: 'WORKER',
      reason: ReportReason.FRAUD,
    });
    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ targetId: 'usuario-reportado' }) }),
    );
  });

  it('convierte P2002 en conflicto de reporte duplicado', async () => {
    const { service, prisma, workers } = setup();
    workers.getWorkerUserId.mockResolvedValue('usuario-reportado');
    prisma.report.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicado', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(
      service.create(reporterId, {
        targetType: ReportTargetType.USER,
        targetId: profileId,
        profileKind: 'WORKER',
        reason: ReportReason.SPAM,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('exige profileKind para usuario y no lo admite para oportunidad', async () => {
    const { service } = setup();
    await expect(
      service.create(reporterId, {
        targetType: ReportTargetType.USER,
        targetId: profileId,
        reason: ReportReason.SPAM,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(reporterId, {
        targetType: ReportTargetType.OPPORTUNITY,
        targetId: profileId,
        profileKind: 'WORKER',
        reason: ReportReason.SPAM,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lista solo los destinos reportados por el usuario y tipo solicitados', async () => {
    const { service, prisma } = setup();
    prisma.report.findMany.mockResolvedValue([{ targetId: 'uno' }, { targetId: 'dos' }]);
    await expect(
      service.listReportedTargetIds(reporterId, ReportTargetType.OPPORTUNITY),
    ).resolves.toEqual(['uno', 'dos']);
    expect(prisma.report.findMany).toHaveBeenCalledWith({
      where: { reporterUserId: reporterId, targetType: ReportTargetType.OPPORTUNITY },
      select: { targetId: true },
    });
  });

  it('responde 404 al perfil inexistente', async () => {
    const { service, workers } = setup();
    workers.getWorkerUserId.mockResolvedValue(null);
    await expect(
      service.create(reporterId, {
        targetType: ReportTargetType.USER,
        targetId: profileId,
        profileKind: 'WORKER',
        reason: ReportReason.SPAM,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
