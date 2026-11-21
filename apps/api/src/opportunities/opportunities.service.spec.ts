import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogsService } from '../catalogs/catalogs.service';
import type { IdentityService } from '../identity/identity.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ProfilesService } from '../profiles/profiles.service';
import type { CreateOpportunityDto } from './dto/create-opportunity.dto';
import type { OpportunitiesContract } from './opportunities.contract';
import { FILLED_REASON, OpportunitiesService } from './opportunities.service';

const NOW = new Date('2026-11-21T12:00:00Z');
const FUTURE = '2026-11-25T15:00:00.000Z';

const task: CreateOpportunityDto = {
  type: 'TASK',
  title: 'Pintar sala comedor',
  description: 'Pintar una sala comedor de 20 metros cuadrados con pintura incluida.',
  categoryId: 3,
  zoneId: 2,
  peopleNeeded: 2,
  paymentCop: 150000,
  scheduledAt: FUTURE,
  durationMinutes: 240,
};

const row = (overrides: object = {}) => ({
  id: 'o1',
  publisherProfileId: 'p1',
  type: 'TASK',
  status: 'ACTIVE',
  title: task.title,
  description: task.description,
  categoryId: 3,
  zoneId: 2,
  peopleNeeded: 2,
  paymentCop: 150000,
  scheduledAt: new Date(FUTURE),
  durationMinutes: 240,
  conditions: null,
  salaryMinCop: null,
  salaryMaxCop: null,
  modality: null,
  schedule: null,
  experienceRequired: null,
  requirements: null,
  closesAt: null,
  laborWarningCodes: [] as string[],
  laborWarningAcknowledgedAt: null as Date | null,
  exactAddress: 'Cra 1 # 2-3',
  searchText: '',
  statusReason: null,
  createdAt: NOW,
  updatedAt: NOW,
  closedAt: null,
  zone: { id: 2, name: 'Sur' },
  category: { id: 3, name: 'Reparaciones del hogar' },
  ...overrides,
});

const FULL_DAY_RULE = { code: 'FULL_DAY', message: 'jornada', params: { minMinutes: 480 } };

const setup = ({ active = true, publisherId = 'p1' as string | null, stored = row() } = {}) => {
  const prisma = {
    opportunity: {
      create: vi.fn().mockImplementation(async ({ data }) => row(data)),
      update: vi.fn().mockImplementation(async ({ data }) => row({ ...stored, ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue(stored),
      findMany: vi.fn().mockResolvedValue([stored]),
      count: vi.fn().mockResolvedValue(1),
    },
    laborWarningRule: { findMany: vi.fn().mockResolvedValue([FULL_DAY_RULE]) },
  };
  const catalogs = {
    getActiveCategory: vi.fn().mockResolvedValue({ id: 3, name: 'Reparaciones del hogar' }),
    isActiveZone: vi.fn().mockResolvedValue(true),
  };
  const profiles = {
    getPublisherIdForUser: vi.fn().mockResolvedValue(publisherId),
    getPublisherCards: vi
      .fn()
      .mockResolvedValue(
        new Map([
          [
            'p1',
            { id: 'p1', kind: 'PERSON', displayName: 'Carla', photoUrl: '/f', isVerified: false },
          ],
        ]),
      ),
    getPublisherUserId: vi.fn().mockResolvedValue('u1'),
  };
  const identity = { isAccountActive: vi.fn().mockResolvedValue(active) };
  const service = new OpportunitiesService(
    prisma as unknown as PrismaService,
    catalogs as unknown as CatalogsService,
    profiles as unknown as ProfilesService,
    identity as unknown as IdentityService,
  );
  return { prisma, catalogs, profiles, service };
};

const response = (error: unknown) => (error as ConflictException).getResponse();

describe('OpportunitiesService.create (HU-025, HU-003, HU-024)', () => {
  it('publica una tarea activa con texto de búsqueda normalizado', async () => {
    const { prisma, service } = setup();
    const result = await service.create('u1', task, NOW);
    const { data } = prisma.opportunity.create.mock.calls[0][0];
    expect(data).toMatchObject({
      publisherProfileId: 'p1',
      type: 'TASK',
      paymentCop: 150000,
      scheduledAt: new Date(FUTURE),
      salaryMinCop: null,
      closesAt: null,
      laborWarningCodes: [],
      laborWarningAcknowledgedAt: null,
      searchText:
        'pintar sala comedor pintar una sala comedor de 20 metros cuadrados con pintura incluida. reparaciones del hogar',
    });
    expect(data).not.toHaveProperty('status');
    expect(result.status).toBe('ACTIVE');
  });

  it('una vacante formal guarda sus campos y deja nulos los de tarea', async () => {
    const { prisma, service } = setup();
    await service.create(
      'u1',
      {
        ...task,
        type: 'FORMAL_JOB',
        salaryMinCop: 1500000,
        modality: 'ONSITE',
        schedule: 'FULL_TIME',
        experienceRequired: '6 meses',
        requirements: 'Bachiller',
        closesAt: FUTURE,
      },
      NOW,
    );
    expect(prisma.opportunity.create.mock.calls[0][0].data).toMatchObject({
      paymentCop: null,
      peopleNeeded: null,
      scheduledAt: null,
      salaryMinCop: 1500000,
      salaryMaxCop: null,
      closesAt: new Date(FUTURE),
    });
  });

  it('cuenta sin confirmar: 403 y no publica', async () => {
    const { prisma, service } = setup({ active: false });
    await expect(service.create('u1', task, NOW)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.opportunity.create).not.toHaveBeenCalled();
  });

  it('sin perfil de publicador: 403 PUBLISHER_PROFILE_REQUIRED (RF-02-04)', async () => {
    const { service } = setup({ publisherId: null });
    const error = await service.create('u1', task, NOW).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(response(error)).toMatchObject({ code: 'PUBLISHER_PROFILE_REQUIRED' });
  });

  it.each([
    ['fecha igual a la actual', { scheduledAt: NOW.toISOString() }, 'scheduledAt'],
    ['fecha pasada', { scheduledAt: '2026-11-20T12:00:00Z' }, 'scheduledAt'],
  ])('rechaza %s', async (_case, overrides, field) => {
    const { service } = setup();
    const error = await service
      .create('u1', { ...task, ...overrides }, NOW)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(response(error)).toMatchObject({
      errors: { [field]: ['La fecha debe ser posterior a la actual'] },
    });
  });

  it('rechaza salario máximo menor que el mínimo', async () => {
    const { service } = setup();
    const dto = {
      ...task,
      type: 'FORMAL_JOB' as const,
      salaryMinCop: 2000,
      salaryMaxCop: 1000,
      closesAt: FUTURE,
    };
    const error = await service.create('u1', dto, NOW).catch((e: unknown) => e);
    expect(response(error)).toMatchObject({ errors: { salaryMaxCop: expect.any(Array) } });
  });

  it('categoría inactiva o zona inexistente: error por campo (RN-17)', async () => {
    const { catalogs, service } = setup();
    catalogs.getActiveCategory.mockResolvedValueOnce(null);
    expect(response(await service.create('u1', task, NOW).catch((e: unknown) => e))).toMatchObject({
      errors: { categoryId: ['Elige una categoría de la lista'] },
    });
    catalogs.isActiveZone.mockResolvedValueOnce(false);
    expect(response(await service.create('u1', task, NOW).catch((e: unknown) => e))).toMatchObject({
      errors: { zoneId: ['Elige una zona de Cali de la lista'] },
    });
  });

  it('HU-003 CA2: con advertencia y sin confirmar responde 409 con el texto y no publica', async () => {
    const { prisma, service } = setup();
    const error = await service
      .create('u1', { ...task, durationMinutes: 480 }, NOW)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(response(error)).toMatchObject({
      code: 'LABOR_WARNING_REQUIRED',
      warnings: [{ code: 'FULL_DAY', message: 'jornada' }],
    });
    expect(prisma.opportunity.create).not.toHaveBeenCalled();
  });

  it('HU-003 CA2: confirmada, registra qué advertencia se leyó y cuándo', async () => {
    const { prisma, service } = setup();
    await service.create(
      'u1',
      { ...task, durationMinutes: 480, acknowledgeLaborWarning: true },
      NOW,
    );
    expect(prisma.opportunity.create.mock.calls[0][0].data).toMatchObject({
      laborWarningCodes: ['FULL_DAY'],
      laborWarningAcknowledgedAt: NOW,
    });
  });
});

describe('OpportunitiesService.update (HU-023 CA2)', () => {
  it('combina el cambio con lo guardado y conserva el tipo', async () => {
    const { prisma, service } = setup();
    await service.update('u1', 'o1', { paymentCop: 180000 }, NOW);
    expect(prisma.opportunity.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'o1' },
      data: { paymentCop: 180000, title: task.title, scheduledAt: new Date(FUTURE) },
    });
  });

  it('una advertencia nueva exige confirmar; la ya confirmada no se vuelve a pedir', async () => {
    const { service } = setup();
    const error = await service
      .update('u1', 'o1', { durationMinutes: 500 }, NOW)
      .catch((e: unknown) => e);
    expect(response(error)).toMatchObject({ code: 'LABOR_WARNING_REQUIRED' });

    const acknowledgedAt = new Date('2026-11-01T00:00:00Z');
    const confirmed = setup({
      stored: row({
        durationMinutes: 500,
        laborWarningCodes: ['FULL_DAY'],
        laborWarningAcknowledgedAt: acknowledgedAt,
      }),
    });
    await confirmed.service.update('u1', 'o1', { paymentCop: 200000 }, NOW);
    expect(confirmed.prisma.opportunity.update.mock.calls[0][0].data).toMatchObject({
      laborWarningCodes: ['FULL_DAY'],
      laborWarningAcknowledgedAt: acknowledgedAt,
    });
  });

  it('valida la combinación completa: un pago inválido se rechaza por campo', async () => {
    const { prisma, service } = setup();
    const error = await service.update('u1', 'o1', { paymentCop: 0 }, NOW).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(prisma.opportunity.update).not.toHaveBeenCalled();
  });

  it.each(['CLOSED', 'EXPIRED', 'CANCELLED'])('no edita una publicación %s', async (status) => {
    const { service } = setup({ stored: row({ status }) });
    const error = await service
      .update('u1', 'o1', { paymentCop: 1000 }, NOW)
      .catch((e: unknown) => e);
    expect(response(error)).toMatchObject({ code: 'OPPORTUNITY_NOT_EDITABLE' });
  });

  it('sin IDOR: la publicación de otro publicador responde 404', async () => {
    const { prisma, service } = setup({ publisherId: 'p2' });
    await expect(service.update('u2', 'o1', { paymentCop: 1000 }, NOW)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.opportunity.update).not.toHaveBeenCalled();
  });
});

describe('OpportunitiesService estados (HU-023 CA3, CA4)', () => {
  it('pausar es condicional al estado: si otro cambio ganó, 409', async () => {
    const { prisma, service } = setup();
    await service.pause('u1', 'o1', 'Voy a reprogramar');
    expect(prisma.opportunity.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', status: { in: ['ACTIVE'] } },
      data: { status: 'PAUSED', statusReason: 'Voy a reprogramar', closedAt: null },
    });
    prisma.opportunity.updateMany.mockResolvedValueOnce({ count: 0 });
    const error = await service.pause('u1', 'o1', 'otra vez').catch((e: unknown) => e);
    expect(response(error)).toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
  });

  it('cancelar una cerrada se permite y registra la fecha', async () => {
    const { prisma, service } = setup();
    await service.cancel('u1', 'o1', 'Ya no lo necesito');
    const { where, data } = prisma.opportunity.updateMany.mock.calls[0][0];
    expect(where.status.in).toEqual(['ACTIVE', 'PAUSED', 'CLOSED']);
    expect(data.closedAt).toBeInstanceOf(Date);
  });

  it('reactivar exige que esté pausada y que su fecha no haya pasado', async () => {
    const active = setup();
    expect(
      response(await active.service.resume('u1', 'o1', NOW).catch((e: unknown) => e)),
    ).toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
    });
    const past = setup({
      stored: row({ status: 'PAUSED', scheduledAt: new Date('2026-11-20T00:00:00Z') }),
    });
    expect(
      response(await past.service.resume('u1', 'o1', NOW).catch((e: unknown) => e)),
    ).toMatchObject({
      code: 'OPPORTUNITY_DATE_PASSED',
    });
  });

  it('la dirección exacta vacía se borra y no se guarda en publicaciones vencidas', async () => {
    const { prisma, service } = setup();
    await service.setExactAddress('u1', 'o1', '');
    expect(prisma.opportunity.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { exactAddress: null },
    });
    const expired = setup({ stored: row({ status: 'EXPIRED' }) });
    await expect(expired.service.setExactAddress('u1', 'o1', 'Cra 1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('RF-03-10: vence tareas por fecha de realización y vacantes por fecha de cierre', async () => {
    const { prisma, service } = setup();
    prisma.opportunity.updateMany.mockResolvedValueOnce({ count: 3 });
    expect(await service.expireDue(NOW)).toBe(3);
    expect(prisma.opportunity.updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['ACTIVE', 'PAUSED'] },
        OR: [
          { type: { not: 'FORMAL_JOB' }, scheduledAt: { lte: NOW } },
          { type: 'FORMAL_JOB', closesAt: { lte: NOW } },
        ],
      },
      data: { status: 'EXPIRED', closedAt: NOW },
    });
  });
});

describe('OpportunitiesService lecturas (HU-009, HU-010, HU-026, HU-023 CA1)', () => {
  it('feed de tareas: solo activas con fecha futura, búsqueda por cada palabra sin tildes', async () => {
    const { prisma, service } = setup();
    await service.listFeed(
      { mode: 'tasks', q: '  SALA  Comedór ', zoneId: 2, paymentMin: 100000 },
      NOW,
    );
    const { where, orderBy, skip, take } = prisma.opportunity.findMany.mock.calls[0][0];
    expect(where).toMatchObject({
      status: 'ACTIVE',
      AND: [{ searchText: { contains: 'sala' } }, { searchText: { contains: 'comedor' } }],
      zoneId: 2,
      type: { not: 'FORMAL_JOB' },
      scheduledAt: { gt: NOW },
      paymentCop: { gte: 100000, lte: undefined },
    });
    expect(orderBy).toEqual([{ scheduledAt: 'asc' }, { id: 'asc' }]);
    expect({ skip, take }).toEqual({ skip: 0, take: 20 });
  });

  it('feed formal: rango salarial que se cruza con el pedido y paginación', async () => {
    const { prisma, service } = setup();
    const result = await service.listFeed(
      { mode: 'formal', salaryMin: 1700000, modality: 'REMOTE', page: 3, pageSize: 10 },
      NOW,
    );
    const { where, orderBy, skip, take } = prisma.opportunity.findMany.mock.calls[0][0];
    expect(where).toMatchObject({
      type: 'FORMAL_JOB',
      closesAt: { gt: NOW },
      modality: 'REMOTE',
      OR: [
        { salaryMaxCop: { gte: 1700000 } },
        { salaryMaxCop: null, salaryMinCop: { gte: 1700000 } },
      ],
    });
    expect(orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
    expect({ skip, take }).toEqual({ skip: 20, take: 10 });
    expect(result).toMatchObject({ page: 3, pageSize: 10, total: 1 });
  });

  it('un tipo FORMAL_JOB en modo tareas no cuela vacantes', async () => {
    const { prisma, service } = setup();
    await service.listFeed({ mode: 'tasks', type: 'FORMAL_JOB' }, NOW);
    expect(prisma.opportunity.findMany.mock.calls[0][0].where.type).toEqual({ not: 'FORMAL_JOB' });
  });

  it('RF-02-07: el feed y el detalle público nunca incluyen la dirección exacta ni el motivo', async () => {
    const { service } = setup();
    const feed = await service.listFeed({ mode: 'tasks' }, NOW);
    const detail = await service.getPublic('o1');
    for (const view of [feed.items[0], detail]) {
      expect(view).not.toHaveProperty('exactAddress');
      expect(view).not.toHaveProperty('statusReason');
      expect(view).not.toHaveProperty('publisherProfileId');
      expect(view.publisher).toMatchObject({ displayName: 'Carla' });
    }
  });

  it('el dueño sí ve la dirección exacta en su vista', async () => {
    const { service } = setup();
    expect(await service.getOwn('u1', 'o1')).toMatchObject({ exactAddress: 'Cra 1 # 2-3' });
  });

  it('una publicación cancelada no tiene detalle público', async () => {
    const { service } = setup({ stored: row({ status: 'CANCELLED' }) });
    await expect(service.getPublic('o1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('"Mis publicaciones" sin perfil de publicador es una lista vacía', async () => {
    const { prisma, service } = setup({ publisherId: null });
    expect(await service.listMine('u1', {})).toMatchObject({ items: [], total: 0 });
    expect(prisma.opportunity.findMany).not.toHaveBeenCalled();
  });
});

describe('OpportunitiesService como contrato de engagements', () => {
  it('cumple la interfaz publicada', () => {
    const { service } = setup();
    const contract: OpportunitiesContract = service;
    expect(typeof contract.getForEngagement).toBe('function');
  });

  it('getForEngagement incluye al usuario publicador y la dirección exacta', async () => {
    const { service } = setup();
    expect(await service.getForEngagement('o1')).toEqual({
      id: 'o1',
      type: 'TASK',
      status: 'ACTIVE',
      title: task.title,
      publisherProfileId: 'p1',
      publisherUserId: 'u1',
      peopleNeeded: 2,
      scheduledAt: new Date(FUTURE),
      durationMinutes: 240,
      zone: { id: 2, name: 'Sur' },
      exactAddress: 'Cra 1 # 2-3',
    });
  });

  it('listIdsForPublisherUser filtra por el perfil del usuario y sin perfil devuelve []', async () => {
    const { prisma, service } = setup();
    prisma.opportunity.findMany.mockResolvedValueOnce([{ id: 'o1' }, { id: 'o2' }]);
    expect(await service.listIdsForPublisherUser('u1')).toEqual(['o1', 'o2']);
    expect(prisma.opportunity.findMany).toHaveBeenLastCalledWith({
      where: { publisherProfileId: 'p1' },
      select: { id: true },
    });
    const none = setup({ publisherId: null });
    expect(await none.service.listIdsForPublisherUser('u9')).toEqual([]);
    expect(none.prisma.opportunity.findMany).not.toHaveBeenCalled();
  });

  it('getForEngagement de una oportunidad inexistente es null', async () => {
    const { prisma, service } = setup();
    prisma.opportunity.findUnique.mockResolvedValueOnce(null);
    expect(await service.getForEngagement('x')).toBeNull();
  });

  it('markFilled solo cierra si está activa y reopenIfFilled solo reabre las cerradas por cupos con fecha futura', async () => {
    const { prisma, service } = setup();
    await service.markFilled('o1', NOW);
    expect(prisma.opportunity.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'o1', status: 'ACTIVE' },
      data: { status: 'CLOSED', statusReason: FILLED_REASON, closedAt: NOW },
    });
    await service.reopenIfFilled('o1', NOW);
    expect(prisma.opportunity.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'o1',
        status: 'CLOSED',
        statusReason: FILLED_REASON,
        OR: [{ scheduledAt: { gt: NOW } }, { closesAt: { gt: NOW } }],
      },
      data: { status: 'ACTIVE', statusReason: null, closedAt: null },
    });
  });
});
