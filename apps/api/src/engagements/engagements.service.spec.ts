import { describe, expect, it, vi } from 'vitest';
import type { ApplicationsContract } from '../applications/applications.contract';
import type { IdentityService } from '../identity/identity.service';
import type { OpportunitiesContract } from '../opportunities/opportunities.contract';
import type { PrismaService } from '../prisma/prisma.service';
import type { RatingsService } from '../ratings/ratings.service';
import { EngagementsService, SELECTION_TTL_MS } from './engagements.service';

const future = new Date('2100-03-03T00:00:00Z');
const post = (id: string, workerUserId = 'trabajador') => ({
  id,
  workerUserId,
  opportunityId: 'o',
  workerProfileId: 'perfil',
  status: 'RECEIVED',
});

function setup() {
  const opportunity = {
    id: 'o',
    publisherUserId: 'publicador',
    type: 'ONE_TIME',
    status: 'ACTIVE',
    peopleNeeded: 2,
    scheduledAt: future,
    exactAddress: 'Calle 1',
    title: 'Oficio',
    zone: { name: 'Sur' },
  };
  const applicants = [post('a'), post('b', 'otra'), post('c', 'tercera')];
  const opportunities = {
    getForEngagement: vi.fn().mockResolvedValue(opportunity),
    listIdsForPublisherUser: vi.fn().mockResolvedValue(['o']),
    markFilled: vi.fn().mockResolvedValue(undefined),
    reopenIfFilled: vi.fn().mockResolvedValue(undefined),
  };
  const applications = {
    getWithParties: vi.fn((id: string) => Promise.resolve(applicants.find((row) => row.id === id))),
    listForOpportunity: vi.fn().mockResolvedValue(applicants),
    listIdsForWorkerUser: vi
      .fn()
      .mockResolvedValue({ workerProfileId: 'perfil', applicationIds: ['a'] }),
    setStatus: vi.fn().mockResolvedValue(undefined),
  };
  const selection = {
    id: 's',
    applicationId: 'a',
    status: 'PENDING',
    expiresAt: future,
    termsAcceptedAt: future,
  };
  const job = {
    id: 't',
    selectionId: 's',
    opportunityId: 'o',
    status: 'IN_PROGRESS',
    finishMarkedById: 'trabajador',
    cancelledById: 'publicador',
    workerProfileId: 'perfil',
    scheduledAt: future,
  };
  const tx = {
    selection: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(selection),
      createManyAndReturn: vi.fn().mockResolvedValue([selection]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    job: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(job),
      findUnique: vi.fn().mockResolvedValue(job),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: (operation: ((client: typeof tx) => unknown) | Promise<unknown>[]) =>
      Array.isArray(operation) ? Promise.all(operation) : operation(tx),
  };
  const notifications = { notifyMany: vi.fn().mockResolvedValue(undefined), notify: vi.fn() };
  const identity = { getContact: vi.fn().mockResolvedValue({ name: 'Ana', phone: '3001234567' }) };
  const ratings = { hasRated: vi.fn().mockResolvedValue(false), recordCompletedJob: vi.fn() };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new EngagementsService(
    prisma as unknown as PrismaService,
    opportunities as unknown as OpportunitiesContract,
    applications as unknown as ApplicationsContract,
    notifications,
    identity as unknown as IdentityService,
    ratings as unknown as RatingsService,
    audit,
  );
  return {
    audit,
    service,
    tx,
    opportunity,
    selection,
    job,
    opportunities,
    applications,
    notifications,
    identity,
  };
}

describe('HU-006 Selección', () => {
  it('admite exactamente N y crea los enlaces de selección por 24 horas', async () => {
    const { service, tx, notifications } = setup();
    const before = Date.now();
    await service.select('o', 'publicador', ['a', 'b']);
    const data = tx.selection.createManyAndReturn.mock.calls[0][0].data;
    expect(data.map(({ applicationId }: { applicationId: string }) => applicationId)).toEqual([
      'a',
      'b',
    ]);
    expect(data[0].expiresAt.getTime()).toBeGreaterThanOrEqual(before + SELECTION_TTL_MS);
    expect(notifications.notifyMany).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 'trabajador',
        link: '/mi-actividad/selecciones/s',
        title: 'Te seleccionaron para una oportunidad',
        body: '"Oficio": te seleccionaron para una oportunidad',
      }),
    ]);
  });

  it('rechaza N+1 sin crear ninguna selección', async () => {
    const { service, tx, selection } = setup();
    tx.selection.findMany.mockResolvedValue([selection]);
    await expect(service.select('o', 'publicador', ['b', 'c'])).rejects.toMatchObject({
      response: { code: 'SELECTION_LIMIT_REACHED' },
    });
    expect(tx.selection.createManyAndReturn).not.toHaveBeenCalled();
  });

  it.each([{ type: 'FORMAL_JOB' }, { status: 'CLOSED' }])(
    'rechaza una oportunidad fuera del flujo %j',
    async (overrides) => {
      const { service, opportunity } = setup();
      Object.assign(opportunity, overrides);
      await expect(service.select('o', 'publicador', ['a'])).rejects.toMatchObject({
        response: { code: 'OPPORTUNITY_NOT_OPEN' },
      });
    },
  );

  it('oculta la oportunidad a un publicador ajeno y la selección a otro trabajador', async () => {
    const { service, tx } = setup();
    await expect(service.select('o', 'otro', ['a'])).rejects.toMatchObject({ status: 404 });
    await expect(service.accept('s', 'otra', true)).rejects.toMatchObject({ status: 404 });
    expect(tx.selection.updateMany).not.toHaveBeenCalled();
  });

  it('solo una aceptación simultánea crea el trabajo', async () => {
    const { service, tx } = setup();
    tx.selection.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const responses = await Promise.allSettled([
      service.accept('s', 'trabajador', true),
      service.accept('s', 'trabajador', true),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(tx.job.create).toHaveBeenCalledTimes(1);
  });

  it('rechaza aceptar una selección vencida', async () => {
    const { service, tx } = setup();
    tx.selection.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.accept('s', 'trabajador', true)).rejects.toMatchObject({
      response: { code: 'SELECTION_NOT_AVAILABLE' },
    });
    expect(tx.selection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's', status: 'PENDING', expiresAt: { gt: expect.any(Date) } },
      }),
    );
    expect(tx.job.create).not.toHaveBeenCalled();
  });

  it('HU-038 CA1: aceptar genera el acuerdo y lo audita dentro de la transacción', async () => {
    const { audit, service, tx, job } = setup();
    await service.accept('s', 'trabajador', true);
    expect(audit.record).toHaveBeenCalledWith(
      {
        actorUserId: 'trabajador',
        action: 'AGREEMENT_ACCEPTED',
        targetType: 'job',
        targetId: job.id,
        data: { selectionId: 's', opportunityId: 'o' },
      },
      tx,
    );
  });

  it('si la auditoría falla, el trabajo no se acepta ni se avisa', async () => {
    const { audit, service, notifications } = setup();
    audit.record.mockRejectedValue(new Error('db'));
    await expect(service.accept('s', 'trabajador', true)).rejects.toThrow('db');
    expect(notifications.notifyMany).not.toHaveBeenCalled();
  });

  it('al llenar N cierra la oportunidad y rechaza a los demás postulantes', async () => {
    const { service, tx, selection, opportunities, applications } = setup();
    tx.job.count.mockResolvedValue(2);
    tx.selection.findMany.mockResolvedValue([selection, { ...selection, applicationId: 'b' }]);
    await service.accept('s', 'trabajador', true);
    expect(opportunities.markFilled).toHaveBeenCalledWith('o');
    expect(applications.setStatus.mock.calls).toEqual([
      ['a', 'ACCEPTED'],
      ['c', 'REJECTED'],
    ]);
  });

  it('libera el cupo al rechazar y solo procesa el vencimiento una vez', async () => {
    const { service, tx, selection, opportunities, notifications } = setup();
    await service.reject('s', 'trabajador');
    tx.selection.findMany.mockResolvedValue([selection]);
    tx.selection.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await service.expireSelections(future);
    await service.expireSelections(future);
    expect(opportunities.reopenIfFilled).toHaveBeenCalledTimes(2);
    expect(notifications.notifyMany.mock.calls.map(([batch]) => batch[0].type)).toEqual([
      'SELECTION_REJECTED',
      'SELECTION_EXPIRED',
    ]);
  });
});

describe('HU-028 Trabajos', () => {
  it('solo inicia trabajos programados al llegar su fecha en cada ejecución', async () => {
    const { service, tx } = setup();
    await service.startDueJobs(future);
    await service.startDueJobs(future);
    expect(tx.job.updateMany).toHaveBeenNthCalledWith(2, {
      where: { status: 'SCHEDULED', scheduledAt: { lte: future } },
      data: { status: 'IN_PROGRESS' },
    });
  });

  it('quien marcó el trabajo no puede confirmar su propia finalización', async () => {
    const { service, tx, selection } = setup();
    selection.status = 'ACCEPTED';
    await expect(service.confirmFinished('t', 'trabajador')).rejects.toMatchObject({
      response: { code: 'FINISH_NEEDS_OTHER_PARTY' },
    });
    expect(tx.job.updateMany).not.toHaveBeenCalled();
  });

  it('rechaza cancelar un trabajo en curso', async () => {
    const { service, tx, selection, opportunities } = setup();
    selection.status = 'ACCEPTED';
    tx.job.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.cancelJob('t', 'trabajador', 'Motivo válido')).rejects.toMatchObject({
      response: { code: 'JOB_CANNOT_BE_CANCELLED' },
    });
    expect(opportunities.reopenIfFilled).not.toHaveBeenCalled();
  });

  it('muestra dirección y teléfono solo a la contraparte autenticada', async () => {
    const { service, selection, identity } = setup();
    selection.status = 'ACCEPTED';
    await expect(service.getJobDetail('t', 'intruso')).rejects.toMatchObject({ status: 404 });
    expect(identity.getContact).not.toHaveBeenCalled();
    const detail = await service.getJobDetail('t', 'trabajador');
    expect(detail).toMatchObject({
      exactAddress: 'Calle 1',
      counterparty: { phone: '3001234567', name: 'Ana' },
      hasRated: false,
      finishMarkedByMe: true,
      cancelledByMe: false,
    });
    expect(identity.getContact).toHaveBeenCalledWith('publicador');
    for (const field of [
      'finishMarkedById',
      'cancelledById',
      'selectionId',
      'workerProfileId',
      'opportunityId',
    ]) {
      expect(detail).not.toHaveProperty(field);
    }
    await expect(service.getJobDetail('t', 'publicador')).resolves.toMatchObject({
      finishMarkedByMe: false,
      cancelledByMe: true,
    });
  });
});

describe('Listas propias', () => {
  it('filtra las selecciones pendientes por las postulaciones del trabajador', async () => {
    const { service, tx, applications, selection } = setup();
    tx.selection.findMany.mockResolvedValue([selection]);
    await expect(service.listOwnSelections('trabajador')).resolves.toEqual([
      expect.objectContaining({
        id: 's',
        opportunity: expect.objectContaining({ title: 'Oficio' }),
      }),
    ]);
    expect(applications.listIdsForWorkerUser).toHaveBeenCalledWith('trabajador');
    expect(tx.selection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          applicationId: { in: ['a'] },
          status: 'PENDING',
          expiresAt: { gt: expect.any(Date) },
        },
      }),
    );
    expect(applications.getWithParties).toHaveBeenCalledExactlyOnceWith('a');
  });

  it('devuelve las selecciones vacías sin consultar Prisma si no hay postulaciones', async () => {
    const { service, tx, applications, opportunities } = setup();
    applications.listIdsForWorkerUser.mockResolvedValue({
      workerProfileId: null,
      applicationIds: [],
    });
    await expect(service.listOwnSelections('trabajador')).resolves.toEqual([]);
    expect(tx.selection.findMany).not.toHaveBeenCalled();
    expect(opportunities.getForEngagement).not.toHaveBeenCalled();
  });

  it.each([
    { role: 'worker', userId: 'trabajador', ownerFilter: { workerProfileId: 'perfil' } },
    { role: 'publisher', userId: 'publicador', ownerFilter: { opportunityId: { in: ['o'] } } },
  ] as const)(
    'pagina en la base los trabajos del rol $role y resuelve solo la página',
    async ({ role, userId, ownerFilter }) => {
      const { service, tx, job, selection, applications, opportunities, identity } = setup();
      selection.status = 'ACCEPTED';
      tx.job.count.mockResolvedValue(3);
      tx.job.findMany.mockResolvedValue([job]);
      const where = { ...ownerFilter, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } };
      const response = await service.listOwnJobs(userId, {
        role,
        state: 'active',
        page: 2,
        pageSize: 2,
      });
      expect(tx.job.count).toHaveBeenCalledExactlyOnceWith({ where });
      expect(tx.job.findMany).toHaveBeenCalledExactlyOnceWith({
        where,
        orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
        skip: 2,
        take: 2,
      });
      if (role === 'worker') {
        expect(applications.listIdsForWorkerUser).toHaveBeenCalledExactlyOnceWith(userId);
        expect(opportunities.listIdsForPublisherUser).not.toHaveBeenCalled();
      } else {
        expect(opportunities.listIdsForPublisherUser).toHaveBeenCalledExactlyOnceWith(userId);
        expect(applications.listIdsForWorkerUser).not.toHaveBeenCalled();
      }
      expect(response).toEqual({
        items: [
          {
            id: 't',
            title: 'Oficio',
            type: 'ONE_TIME',
            zone: { name: 'Sur' },
            scheduledAt: future,
            status: 'IN_PROGRESS',
            counterparty: { name: 'Ana' },
          },
        ],
        total: 3,
        page: 2,
        pageSize: 2,
      });
      expect(opportunities.getForEngagement).toHaveBeenCalledExactlyOnceWith('o');
      expect(identity.getContact).toHaveBeenCalledExactlyOnceWith(
        role === 'worker' ? 'publicador' : 'trabajador',
      );
    },
  );

  it.each(['worker', 'publisher'] as const)(
    'devuelve trabajos vacíos para %s sin consultar Prisma',
    async (role) => {
      const { service, tx, applications, opportunities } = setup();
      applications.listIdsForWorkerUser.mockResolvedValue({
        workerProfileId: null,
        applicationIds: [],
      });
      opportunities.listIdsForPublisherUser.mockResolvedValue([]);
      await expect(
        service.listOwnJobs('usuario', { role, state: 'finished', page: 2, pageSize: 3 }),
      ).resolves.toEqual({ items: [], total: 0, page: 2, pageSize: 3 });
      expect(tx.job.count).not.toHaveBeenCalled();
      expect(tx.job.findMany).not.toHaveBeenCalled();
    },
  );
});

describe('Notificaciones de trabajos', () => {
  it('incluye el título de la oportunidad, limita el cuerpo y omite los datos de contacto', async () => {
    const { service, selection, opportunity, notifications, identity } = setup();
    selection.status = 'ACCEPTED';
    opportunity.title = 'Oficio '.repeat(80);
    await service.markFinished('t', 'trabajador');
    const [event] = notifications.notifyMany.mock.calls[0][0];
    expect(event.title).toBe('La otra persona marcó el trabajo como terminado');
    expect(event.body).toBe(
      `"${opportunity.title}": la otra persona marcó el trabajo como terminado`.slice(0, 500),
    );
    expect(JSON.stringify(event)).not.toContain(opportunity.exactAddress);
    expect(identity.getContact).not.toHaveBeenCalled();
  });

  it('RF-07-07: el aviso de trabajo terminado lleva al detalle del trabajo, donde se confirma', async () => {
    const { service, selection, notifications } = setup();
    selection.status = 'ACCEPTED';
    await service.markFinished('t', 'trabajador');
    expect(notifications.notifyMany.mock.calls[0][0][0].link).toBe('/mi-actividad/trabajos/t');
  });
});
