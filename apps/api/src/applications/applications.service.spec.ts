import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { IdentityService } from '../identity/identity.service';
import type { OpportunitiesService } from '../opportunities/opportunities.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { WorkerProfilesService } from '../profiles/worker-profiles.service';
import type { ApplicationsContract } from './applications.contract';
import { ApplicationsService } from './applications.service';

const NOW = new Date('2026-11-21T12:00:00Z');
const FUTURE = new Date('2026-11-25T15:00:00Z');

const opportunity = (overrides: object = {}) => ({
  id: 'o1',
  type: 'TASK',
  status: 'ACTIVE',
  title: 'Pintar una habitación',
  publisherProfileId: 'p1',
  publisherUserId: 'pub',
  peopleNeeded: 1,
  scheduledAt: FUTURE,
  durationMinutes: 180,
  zone: { id: 2, name: 'Sur' },
  exactAddress: 'Calle 5',
  ...overrides,
});

const card = (id: string, userId: string, overrides: object = {}) => ({
  id,
  userId,
  displayName: `Trabajador ${id}`,
  photoUrl: `/v1/profiles/worker/${id}/photo`,
  availability: 'AVAILABLE',
  skills: ['Pintura'],
  zone: { id: 2, name: 'Sur' },
  ...overrides,
});

const setup = ({
  active = true,
  workerProfileId = 'wp1' as string | null,
  opp = opportunity() as ReturnType<typeof opportunity> | null,
  open = true,
} = {}) => {
  const prisma = {
    application: {
      create: vi.fn().mockImplementation(async ({ data }) => ({
        id: 'a1',
        status: 'RECEIVED',
        createdAt: NOW,
        ...data,
      })),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
  };
  const opportunities = {
    getForEngagement: vi.fn().mockResolvedValue(opp),
    getPublicByIds: vi
      .fn()
      .mockResolvedValue(new Map(opp ? [[opp.id, { ...opp, closesAt: null }]] : [])),
    isOpenForApplications: vi.fn().mockReturnValue(open),
  };
  const workers = {
    getIdForUser: vi.fn().mockResolvedValue(workerProfileId),
    getCards: vi.fn().mockResolvedValue(new Map([['wp1', card('wp1', 'w1')]])),
  };
  const identity = { isAccountActive: vi.fn().mockResolvedValue(active) };
  const notifications = { notify: vi.fn().mockResolvedValue(undefined), notifyMany: vi.fn() };
  const service = new ApplicationsService(
    prisma as unknown as PrismaService,
    opportunities as unknown as OpportunitiesService,
    workers as unknown as WorkerProfilesService,
    identity as unknown as IdentityService,
    notifications,
  );
  return { prisma, opportunities, workers, notifications, service };
};

const codeOf = async (promise: Promise<unknown>) =>
  ((await promise.catch((error: unknown) => error)) as ConflictException).getResponse();

describe('ApplicationsService.apply (HU-005)', () => {
  it('CA1: registra el interés, avisa al publicador y queda "Recibida"', async () => {
    const { prisma, notifications, service } = setup();
    const result = await service.apply('w1', 'o1', {}, NOW);
    expect(prisma.application.create.mock.calls[0][0].data).toEqual({
      opportunityId: 'o1',
      workerProfileId: 'wp1',
      message: null,
    });
    expect(result.status).toBe('RECEIVED');
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'pub',
        type: 'NEW_APPLICANT',
        title: 'Un nuevo perfil está interesado en tu oportunidad',
        body: '"Pintar una habitación"',
      }),
    );
  });

  it('CA4: en vacante formal guarda el mensaje; en una tarea lo ignora', async () => {
    const formal = setup({ opp: opportunity({ type: 'FORMAL_JOB' }) });
    await formal.service.apply('w1', 'o1', { message: 'Tengo experiencia' }, NOW);
    expect(formal.prisma.application.create.mock.calls[0][0].data.message).toBe(
      'Tengo experiencia',
    );
    const task = setup();
    await task.service.apply('w1', 'o1', { message: 'Hola' }, NOW);
    expect(task.prisma.application.create.mock.calls[0][0].data.message).toBeNull();
  });

  it('CA2: una segunda postulación (o dos simultáneas) responde 409 ALREADY_APPLIED', async () => {
    const { prisma, notifications, service } = setup();
    prisma.application.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', { code: 'P2002', clientVersion: 'x' }),
    );
    expect(await codeOf(service.apply('w1', 'o1', {}, NOW))).toMatchObject({
      code: 'ALREADY_APPLIED',
    });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('CA3: cerrada, llena o vencida responde 409 OPPORTUNITY_NOT_AVAILABLE', async () => {
    const { prisma, service } = setup({ open: false });
    expect(await codeOf(service.apply('w1', 'o1', {}, NOW))).toMatchObject({
      code: 'OPPORTUNITY_NOT_AVAILABLE',
    });
    expect(prisma.application.create).not.toHaveBeenCalled();
  });

  it('CA5: sin correo confirmado o sin perfil indica qué falta', async () => {
    const unconfirmed = setup({ active: false });
    const error = await unconfirmed.service.apply('w1', 'o1', {}, NOW).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: 'EMAIL_NOT_CONFIRMED',
    });
    const noProfile = setup({ workerProfileId: null });
    expect(await codeOf(noProfile.service.apply('w1', 'o1', {}, NOW))).toMatchObject({
      code: 'WORKER_PROFILE_REQUIRED',
    });
  });

  it('RN-07: nadie se postula a su propia publicación', async () => {
    const { service } = setup();
    expect(await codeOf(service.apply('pub', 'o1', {}, NOW))).toMatchObject({
      code: 'OWN_OPPORTUNITY',
    });
  });

  it('oportunidad inexistente o cancelada: 404', async () => {
    await expect(setup({ opp: null }).service.apply('w1', 'x', {}, NOW)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      setup({ opp: opportunity({ status: 'CANCELLED' }) }).service.apply('w1', 'o1', {}, NOW),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ApplicationsService lecturas (HU-013, HU-005 CA2)', () => {
  it('"Postulaciones activas" filtra por el perfil del usuario y los estados activos, paginado', async () => {
    const { prisma, service } = setup();
    prisma.application.findMany.mockResolvedValue([
      { id: 'a1', status: 'RECEIVED', opportunityId: 'o1', message: null, createdAt: NOW },
    ]);
    prisma.application.count.mockResolvedValue(21);
    const result = await service.listMine('w1', { page: 2, pageSize: 20, state: 'active' });
    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workerProfileId: 'wp1', status: { in: ['RECEIVED', 'IN_REVIEW', 'INTERVIEW'] } },
        skip: 20,
        take: 20,
      }),
    );
    expect(result).toMatchObject({ total: 21, items: [{ id: 'a1', opportunity: { id: 'o1' } }] });
  });

  it('sin perfil de trabajador: listas y estados vacíos sin consultar postulaciones', async () => {
    const { prisma, service } = setup({ workerProfileId: null });
    expect(await service.listMine('w1', { page: 1, pageSize: 20, state: 'all' })).toMatchObject({
      items: [],
      total: 0,
    });
    expect(await service.statusFor('w1', ['o1'])).toEqual({});
    expect(prisma.application.findMany).not.toHaveBeenCalled();
  });

  it('estado por tarjeta: { oportunidad: estado } solo del usuario', async () => {
    const { prisma, service } = setup();
    prisma.application.findMany.mockResolvedValue([{ opportunityId: 'o1', status: 'RECEIVED' }]);
    expect(await service.statusFor('w1', ['o1', 'o2'])).toEqual({ o1: 'RECEIVED' });
    expect(prisma.application.findMany.mock.calls[0][0].where).toEqual({
      workerProfileId: 'wp1',
      opportunityId: { in: ['o1', 'o2'] },
    });
  });
});

describe('ApplicationsService postulantes de vacante formal (HU-024 CA2–CA3)', () => {
  const formal = () => {
    const ctx = setup({ opp: opportunity({ type: 'FORMAL_JOB' }) });
    ctx.prisma.application.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'RECEIVED',
      opportunityId: 'o1',
      workerProfileId: 'wp1',
      createdAt: NOW,
    });
    return ctx;
  };

  it('cambia el estado de forma condicional y avisa al postulante', async () => {
    const { prisma, notifications, service } = formal();
    expect(await service.changeStatus('pub', 'a1', { status: 'INTERVIEW' })).toEqual({
      id: 'a1',
      status: 'INTERVIEW',
    });
    expect(prisma.application.updateMany).toHaveBeenCalledWith({
      where: { id: 'a1', status: { in: ['RECEIVED', 'IN_REVIEW', 'INTERVIEW'] } },
      data: { status: 'INTERVIEW' },
    });
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'w1',
        type: 'APPLICATION_STATUS_CHANGED',
        title: 'Tu postulación ahora está: Entrevista',
      }),
    );
  });

  it('una postulación ya aceptada o rechazada no cambia: 409 APPLICATION_CLOSED', async () => {
    const { prisma, notifications, service } = formal();
    prisma.application.updateMany.mockResolvedValue({ count: 0 });
    expect(await codeOf(service.changeStatus('pub', 'a1', { status: 'REJECTED' }))).toMatchObject({
      code: 'APPLICATION_CLOSED',
    });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('sin IDOR: otro usuario recibe 404 y no cambia nada', async () => {
    const { prisma, service } = formal();
    await expect(
      service.changeStatus('intruso', 'a1', { status: 'ACCEPTED' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.listCandidates('intruso', 'o1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.application.updateMany).not.toHaveBeenCalled();
  });

  it('en tareas los interesados se gestionan con la selección: 409 NOT_A_FORMAL_JOB', async () => {
    const { service } = setup();
    expect(await codeOf(service.listCandidates('pub', 'o1'))).toMatchObject({
      code: 'NOT_A_FORMAL_JOB',
    });
  });
});

describe('ApplicationsService como contrato APPLICATIONS', () => {
  it('cumple la interfaz publicada', () => {
    const contract: ApplicationsContract = setup().service;
    expect(typeof contract.countForOpportunities).toBe('function');
  });

  it('listForOpportunity omite retiradas, ordena por llegada y respeta la foto oculta (HU-030 CA4)', async () => {
    const { prisma, workers, service } = setup();
    prisma.application.findMany.mockResolvedValue([
      { id: 'a1', status: 'RECEIVED', opportunityId: 'o1', workerProfileId: 'wp1', createdAt: NOW },
      { id: 'a2', status: 'RECEIVED', opportunityId: 'o1', workerProfileId: 'wp9', createdAt: NOW },
    ]);
    workers.getCards.mockResolvedValue(new Map([['wp1', card('wp1', 'w1', { photoUrl: null })]]));
    const result = await service.listForOpportunity('o1');
    expect(prisma.application.findMany.mock.calls[0][0]).toMatchObject({
      where: { opportunityId: 'o1', status: { not: 'WITHDRAWN' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    // wp9 ya no existe: se omite en vez de fallar.
    expect(result).toEqual([
      {
        id: 'a1',
        status: 'RECEIVED',
        opportunityId: 'o1',
        workerProfileId: 'wp1',
        createdAt: NOW,
        workerUserId: 'w1',
        worker: {
          displayName: 'Trabajador wp1',
          photoUrl: null,
          availability: 'AVAILABLE',
          skills: ['Pintura'],
          zone: { id: 2, name: 'Sur' },
        },
      },
    ]);
  });

  it('getWithParties resuelve el usuario trabajador; inexistente es null', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValueOnce({
      id: 'a1',
      status: 'RECEIVED',
      opportunityId: 'o1',
      workerProfileId: 'wp1',
      createdAt: NOW,
    });
    expect(await service.getWithParties('a1')).toMatchObject({ id: 'a1', workerUserId: 'w1' });
    prisma.application.findUnique.mockResolvedValueOnce(null);
    expect(await service.getWithParties('x')).toBeNull();
  });

  it('listIdsForWorkerUser y countForOpportunities', async () => {
    const { prisma, service } = setup();
    prisma.application.findMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
    expect(await service.listIdsForWorkerUser('w1')).toEqual({
      workerProfileId: 'wp1',
      applicationIds: ['a1', 'a2'],
    });
    prisma.application.groupBy.mockResolvedValue([
      { opportunityId: 'o1', status: 'RECEIVED', _count: { _all: 2 } },
      { opportunityId: 'o1', status: 'ACCEPTED', _count: { _all: 1 } },
    ]);
    const counts = await service.countForOpportunities(['o1', 'o2']);
    expect(counts.get('o1')).toEqual({ applicants: 3, accepted: 1 });
    expect(counts.get('o2')).toEqual({ applicants: 0, accepted: 0 });
  });

  it('sin perfil: listIdsForWorkerUser devuelve null y sin ids', async () => {
    expect(await setup({ workerProfileId: null }).service.listIdsForWorkerUser('w1')).toEqual({
      workerProfileId: null,
      applicationIds: [],
    });
  });
});
