import { describe, expect, it, vi } from 'vitest';
import type { ApplicationsContract } from '../applications/applications.contract';
import type { IdentityService } from '../identity/identity.service';
import type { OpportunitiesContract } from '../opportunities/opportunities.contract';
import type { PrismaService } from '../prisma/prisma.service';
import type { RatingsService } from '../ratings/ratings.service';
import { EngagementsService, SELECTION_TTL_MS } from './engagements.service';

const futuro = new Date('2100-03-03T00:00:00Z');
const post = (id: string, workerUserId = 'trabajador') => ({
  id,
  workerUserId,
  opportunityId: 'o',
  workerProfileId: 'perfil',
  status: 'RECEIVED',
});

function preparar() {
  const oportunidad = {
    id: 'o',
    publisherUserId: 'publicador',
    type: 'ONE_TIME',
    status: 'ACTIVE',
    peopleNeeded: 2,
    scheduledAt: futuro,
    exactAddress: 'Calle 1',
    title: 'Oficio',
    zone: { name: 'Sur' },
  };
  const interesados = [post('a'), post('b', 'otra'), post('c', 'tercera')];
  const oportunidades = {
    getForEngagement: vi.fn().mockResolvedValue(oportunidad),
    markFilled: vi.fn().mockResolvedValue(undefined),
    reopenIfFilled: vi.fn().mockResolvedValue(undefined),
  };
  const postulaciones = {
    getWithParties: vi.fn((id: string) =>
      Promise.resolve(interesados.find((fila) => fila.id === id)),
    ),
    listForOpportunity: vi.fn().mockResolvedValue(interesados),
    setStatus: vi.fn().mockResolvedValue(undefined),
  };
  const seleccion = {
    id: 's',
    applicationId: 'a',
    status: 'PENDING',
    expiresAt: futuro,
    termsAcceptedAt: futuro,
  };
  const trabajo = {
    id: 't',
    selectionId: 's',
    opportunityId: 'o',
    status: 'IN_PROGRESS',
    finishMarkedById: 'trabajador',
  };
  const tx = {
    selection: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(seleccion),
      createManyAndReturn: vi.fn().mockResolvedValue([seleccion]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    job: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(trabajo),
      findUnique: vi.fn().mockResolvedValue(trabajo),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = { ...tx, $transaction: (operar: (cliente: typeof tx) => unknown) => operar(tx) };
  const notificaciones = { notifyMany: vi.fn().mockResolvedValue(undefined), notify: vi.fn() };
  const identidad = { getContact: vi.fn().mockResolvedValue({ name: 'Ana', phone: '3001234567' }) };
  const reputacion = { yaCalifico: vi.fn().mockResolvedValue(false), recordCompletedJob: vi.fn() };
  const servicio = new EngagementsService(
    prisma as unknown as PrismaService,
    oportunidades as unknown as OpportunitiesContract,
    postulaciones as unknown as ApplicationsContract,
    notificaciones,
    identidad as unknown as IdentityService,
    reputacion as unknown as RatingsService,
  );
  return {
    servicio,
    tx,
    oportunidad,
    seleccion,
    trabajo,
    oportunidades,
    postulaciones,
    notificaciones,
    identidad,
  };
}

describe('HU-006 Selección', () => {
  it('admite exactamente N y crea los enlaces de selección por 24 horas', async () => {
    const { servicio, tx, notificaciones } = preparar();
    const antes = Date.now();
    await servicio.seleccionar('o', 'publicador', ['a', 'b']);
    const datos = tx.selection.createManyAndReturn.mock.calls[0][0].data;
    expect(datos.map(({ applicationId }: { applicationId: string }) => applicationId)).toEqual([
      'a',
      'b',
    ]);
    expect(datos[0].expiresAt.getTime()).toBeGreaterThanOrEqual(antes + SELECTION_TTL_MS);
    expect(notificaciones.notifyMany).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'trabajador', link: '/mi-actividad/selecciones/s' }),
    ]);
  });

  it('rechaza N+1 sin crear ninguna selección', async () => {
    const { servicio, tx, seleccion } = preparar();
    tx.selection.findMany.mockResolvedValue([seleccion]);
    await expect(servicio.seleccionar('o', 'publicador', ['b', 'c'])).rejects.toMatchObject({
      response: { code: 'SELECTION_LIMIT_REACHED' },
    });
    expect(tx.selection.createManyAndReturn).not.toHaveBeenCalled();
  });

  it.each([{ type: 'FORMAL_JOB' }, { status: 'CLOSED' }])(
    'rechaza una oportunidad fuera del flujo %j',
    async (cambio) => {
      const { servicio, oportunidad } = preparar();
      Object.assign(oportunidad, cambio);
      await expect(servicio.seleccionar('o', 'publicador', ['a'])).rejects.toMatchObject({
        response: { code: 'OPPORTUNITY_NOT_OPEN' },
      });
    },
  );

  it('oculta la oportunidad a un publicador ajeno y la selección a otro trabajador', async () => {
    const { servicio, tx } = preparar();
    await expect(servicio.seleccionar('o', 'otro', ['a'])).rejects.toMatchObject({ status: 404 });
    await expect(servicio.aceptar('s', 'otra', true)).rejects.toMatchObject({ status: 404 });
    expect(tx.selection.updateMany).not.toHaveBeenCalled();
  });

  it('solo una aceptación simultánea crea el trabajo', async () => {
    const { servicio, tx } = preparar();
    tx.selection.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const respuestas = await Promise.allSettled([
      servicio.aceptar('s', 'trabajador', true),
      servicio.aceptar('s', 'trabajador', true),
    ]);
    expect(respuestas.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(tx.job.create).toHaveBeenCalledTimes(1);
  });

  it('rechaza aceptar una selección vencida', async () => {
    const { servicio, tx } = preparar();
    tx.selection.updateMany.mockResolvedValue({ count: 0 });
    await expect(servicio.aceptar('s', 'trabajador', true)).rejects.toMatchObject({
      response: { code: 'SELECTION_NOT_AVAILABLE' },
    });
    expect(tx.selection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's', status: 'PENDING', expiresAt: { gt: expect.any(Date) } },
      }),
    );
    expect(tx.job.create).not.toHaveBeenCalled();
  });

  it('al llenar N cierra la oportunidad y rechaza a los demás postulantes', async () => {
    const { servicio, tx, seleccion, oportunidades, postulaciones } = preparar();
    tx.job.count.mockResolvedValue(2);
    tx.selection.findMany.mockResolvedValue([seleccion, { ...seleccion, applicationId: 'b' }]);
    await servicio.aceptar('s', 'trabajador', true);
    expect(oportunidades.markFilled).toHaveBeenCalledWith('o');
    expect(postulaciones.setStatus.mock.calls).toEqual([
      ['a', 'ACCEPTED'],
      ['c', 'REJECTED'],
    ]);
  });

  it('libera el cupo al rechazar y solo procesa el vencimiento una vez', async () => {
    const { servicio, tx, seleccion, oportunidades, notificaciones } = preparar();
    await servicio.rechazar('s', 'trabajador');
    tx.selection.findMany.mockResolvedValue([seleccion]);
    tx.selection.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await servicio.expireSelections(futuro);
    await servicio.expireSelections(futuro);
    expect(oportunidades.reopenIfFilled).toHaveBeenCalledTimes(2);
    expect(notificaciones.notifyMany.mock.calls.map(([lote]) => lote[0].type)).toEqual([
      'SELECTION_REJECTED',
      'SELECTION_EXPIRED',
    ]);
  });
});

describe('HU-028 Trabajos', () => {
  it('solo inicia trabajos programados al llegar su fecha en cada ejecución', async () => {
    const { servicio, tx } = preparar();
    await servicio.startDueJobs(futuro);
    await servicio.startDueJobs(futuro);
    expect(tx.job.updateMany).toHaveBeenNthCalledWith(2, {
      where: { status: 'SCHEDULED', scheduledAt: { lte: futuro } },
      data: { status: 'IN_PROGRESS' },
    });
  });

  it('quien marcó el trabajo no puede confirmar su propia finalización', async () => {
    const { servicio, tx, seleccion } = preparar();
    seleccion.status = 'ACCEPTED';
    await expect(servicio.confirmarTerminado('t', 'trabajador')).rejects.toMatchObject({
      response: { code: 'FINISH_NEEDS_OTHER_PARTY' },
    });
    expect(tx.job.updateMany).not.toHaveBeenCalled();
  });

  it('rechaza cancelar un trabajo en curso', async () => {
    const { servicio, tx, seleccion, oportunidades } = preparar();
    seleccion.status = 'ACCEPTED';
    tx.job.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      servicio.cancelarTrabajo('t', 'trabajador', 'Motivo válido'),
    ).rejects.toMatchObject({
      response: { code: 'JOB_CANNOT_BE_CANCELLED' },
    });
    expect(oportunidades.reopenIfFilled).not.toHaveBeenCalled();
  });

  it('muestra dirección y teléfono solo a la contraparte autenticada', async () => {
    const { servicio, seleccion, identidad } = preparar();
    seleccion.status = 'ACCEPTED';
    await expect(servicio.detalleTrabajo('t', 'intruso')).rejects.toMatchObject({ status: 404 });
    expect(identidad.getContact).not.toHaveBeenCalled();
    await expect(servicio.detalleTrabajo('t', 'trabajador')).resolves.toMatchObject({
      exactAddress: 'Calle 1',
      counterparty: { phone: '3001234567', name: 'Ana' },
      hasRated: false,
    });
    expect(identidad.getContact).toHaveBeenCalledWith('publicador');
  });
});
