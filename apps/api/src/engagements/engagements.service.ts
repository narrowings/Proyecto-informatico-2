import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import type { Job, Prisma, Selection } from '@prisma/client';
import {
  APPLICATIONS,
  type ApplicationsContract,
  type ApplicationWithParties,
} from '../applications/applications.contract';
import { IdentityService } from '../identity/identity.service';
import {
  NOTIFICATIONS,
  type NotificationsContract,
  type NotifyInput,
} from '../notifications/notifications.contract';
import { OPPORTUNITIES, type OpportunitiesContract } from '../opportunities/opportunities.contract';
import { PrismaService } from '../prisma/prisma.service';
import { esErrorPrisma, transaccionSerializable } from '../prisma/transaccion-serializable';
import { RatingsService } from '../ratings/ratings.service';
import type { ListarTrabajosDto } from './engagements.dto';

export const SELECTION_TTL_MS = 24 * 60 * 60 * 1000;

const noEncontrado = () =>
  new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'No encontramos el recurso' });
const conflicto = (code: string, message: string) => new ConflictException({ code, message });

const mensajes = {
  SELECTION_RECEIVED: 'Te seleccionaron para una oportunidad',
  SELECTION_ACCEPTED: 'Aceptaron la selección',
  SELECTION_REJECTED: 'Rechazaron la selección',
  SELECTION_EXPIRED: 'Venció una selección sin respuesta',
  APPLICATION_STATUS_CHANGED: 'La oportunidad completó sus cupos',
  JOB_FINISH_MARKED: 'La otra persona marcó el trabajo como terminado',
  JOB_COMPLETED: 'El trabajo se completó',
  JOB_CANCELLED: 'La otra persona canceló el trabajo',
  RATING_AVAILABLE: 'Ya puedes calificar el trabajo',
} satisfies Partial<Record<NotifyInput['type'], string>>;

function evento(userId: string, type: keyof typeof mensajes, recursoId: string): NotifyInput {
  return {
    userId,
    type,
    title: mensajes[type],
    body: mensajes[type],
    link:
      type === 'SELECTION_RECEIVED' ? `/mi-actividad/selecciones/${recursoId}` : '/mi-actividad',
    data: { recursoId },
  };
}

@Injectable()
export class EngagementsService {
  private readonly logger = new Logger(EngagementsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OPPORTUNITIES) private readonly oportunidades: OpportunitiesContract,
    @Inject(APPLICATIONS) private readonly postulaciones: ApplicationsContract,
    @Inject(NOTIFICATIONS) private readonly notificaciones: NotificationsContract,
    @Inject(IdentityService) private readonly identidad: IdentityService,
    @Inject(forwardRef(() => RatingsService)) private readonly reputacion: RatingsService,
  ) {}

  private async avisar(eventos: NotifyInput[]) {
    if (!eventos.length) return;
    try {
      await this.notificaciones.notifyMany(eventos);
    } catch {
      this.logger.error('No se pudieron emitir las notificaciones de selección o trabajo');
    }
  }

  private async oportunidadPropia(id: string, usuarioId: string) {
    const oportunidad = await this.oportunidades.getForEngagement(id);
    if (!oportunidad || oportunidad.publisherUserId !== usuarioId) throw noEncontrado();
    return oportunidad;
  }

  private async seleccionesDe(
    tx: Prisma.TransactionClient,
    postulaciones: Pick<ApplicationWithParties, 'id'>[],
  ) {
    return tx.selection.findMany({
      where: { applicationId: { in: postulaciones.map(({ id }) => id) } },
    });
  }

  private cuposOcupados(selecciones: Selection[], trabajosCancelados: { selectionId: string }[]) {
    const cancelados = new Set(trabajosCancelados.map(({ selectionId }) => selectionId));
    return selecciones.filter(
      ({ id, status }) => status === 'PENDING' || (status === 'ACCEPTED' && !cancelados.has(id)),
    ).length;
  }

  private trabajosCancelados(tx: Prisma.TransactionClient, opportunityId: string) {
    return tx.job.findMany({
      where: { opportunityId, status: 'CANCELLED' },
      select: { selectionId: true },
    });
  }

  async aspirantes(id: string, usuarioId: string) {
    const oportunidad = await this.oportunidadPropia(id, usuarioId);
    if (oportunidad.type === 'FORMAL_JOB') {
      throw conflicto('OPPORTUNITY_NOT_OPEN', 'La oportunidad no admite selecciones');
    }
    const postulaciones = await this.postulaciones.listForOpportunity(id);
    const { selecciones, cancelados } = await transaccionSerializable(this.prisma, async (tx) => ({
      selecciones: await this.seleccionesDe(tx, postulaciones),
      cancelados: await this.trabajosCancelados(tx, id),
    }));
    const estados = new Map(
      selecciones.map(({ applicationId, status }) => [applicationId, status]),
    );
    const applicants = await Promise.all(
      postulaciones.map(async (postulacion) => ({
        ...postulacion,
        selectionStatus: estados.get(postulacion.id) ?? null,
        reputation: await this.reputacion.getSummary(postulacion.workerUserId, 'WORKER'),
      })),
    );
    return {
      applicants,
      selected: this.cuposOcupados(selecciones, cancelados),
      needed: oportunidad.peopleNeeded,
    };
  }

  async seleccionar(id: string, usuarioId: string, applicationIds: string[]) {
    const verificarOportunidad = async () => {
      const oportunidad = await this.oportunidadPropia(id, usuarioId);
      if (
        oportunidad.status !== 'ACTIVE' ||
        oportunidad.type === 'FORMAL_JOB' ||
        !oportunidad.peopleNeeded
      ) {
        throw conflicto('OPPORTUNITY_NOT_OPEN', 'La oportunidad no admite selecciones');
      }
      return oportunidad.peopleNeeded;
    };
    const needed = await verificarOportunidad();
    const seleccionadas = await Promise.all(
      applicationIds.map((postulacionId) => this.postulaciones.getWithParties(postulacionId)),
    );
    if (
      seleccionadas.some(
        (postulacion) => !postulacion || postulacion.opportunityId !== id.toLowerCase(),
      )
    ) {
      throw noEncontrado();
    }

    let nuevas: Selection[];
    try {
      nuevas = await transaccionSerializable(this.prisma, async (tx) => {
        const postulaciones = await this.postulaciones.listForOpportunity(id);
        const recibidas = new Set(
          postulaciones.filter(({ status }) => status === 'RECEIVED').map(({ id }) => id),
        );
        const existentes = await this.seleccionesDe(tx, postulaciones);
        const previas = new Set(existentes.map(({ applicationId }) => applicationId));
        if (
          applicationIds.some(
            (applicationId) => !recibidas.has(applicationId) || previas.has(applicationId),
          )
        ) {
          throw conflicto(
            'APPLICATION_NOT_SELECTABLE',
            'Una postulación ya no está disponible para seleccionar',
          );
        }
        const cancelados = await this.trabajosCancelados(tx, id);
        if (this.cuposOcupados(existentes, cancelados) + applicationIds.length > needed) {
          throw conflicto('SELECTION_LIMIT_REACHED', 'La selección supera los cupos disponibles');
        }
        const expiresAt = new Date(Date.now() + SELECTION_TTL_MS);
        return tx.selection.createManyAndReturn({
          data: applicationIds.map((applicationId) => ({ applicationId, expiresAt })),
        });
      });
    } catch (error) {
      if (esErrorPrisma(error, 'P2002')) {
        throw conflicto('APPLICATION_NOT_SELECTABLE', 'Una postulación ya tiene selección');
      }
      throw error;
    }
    const trabajadores = new Map(
      seleccionadas.map((postulacion) => [postulacion!.id, postulacion!.workerUserId]),
    );
    await this.avisar(
      nuevas.map((seleccion) =>
        evento(trabajadores.get(seleccion.applicationId)!, 'SELECTION_RECEIVED', seleccion.id),
      ),
    );
    return nuevas;
  }

  async seleccionesPropias(usuarioId: string) {
    const pendientes = await this.prisma.selection.findMany({
      where: { status: 'PENDING', expiresAt: { gt: new Date() } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const resultados = await Promise.all(
      pendientes.map(async (seleccion) => {
        const postulacion = await this.postulaciones.getWithParties(seleccion.applicationId);
        if (postulacion?.workerUserId !== usuarioId) return null;
        const oportunidad = await this.oportunidades.getForEngagement(postulacion.opportunityId);
        if (!oportunidad) return null;
        const { id, title, zone, scheduledAt } = oportunidad;
        return {
          id: seleccion.id,
          status: seleccion.status,
          expiresAt: seleccion.expiresAt,
          opportunity: { id, title, zone, scheduledAt },
        };
      }),
    );
    return resultados.filter((resultado) => resultado !== null);
  }

  private async seleccionPropia(id: string, usuarioId: string) {
    const seleccion = await this.prisma.selection.findUnique({ where: { id } });
    if (!seleccion) throw noEncontrado();
    const postulacion = await this.postulaciones.getWithParties(seleccion.applicationId);
    if (!postulacion || postulacion.workerUserId !== usuarioId) throw noEncontrado();
    const oportunidad = await this.oportunidades.getForEngagement(postulacion.opportunityId);
    if (!oportunidad) throw noEncontrado();
    return { seleccion, postulacion, oportunidad };
  }

  async aceptar(id: string, usuarioId: string, acceptTerms: true) {
    if (acceptTerms !== true) {
      throw new BadRequestException({
        message: 'Revisa los campos marcados',
        errors: { acceptTerms: ['Debes aceptar los términos del trabajo'] },
      });
    }
    const { postulacion, oportunidad } = await this.seleccionPropia(id, usuarioId);
    if (
      !oportunidad.scheduledAt ||
      !oportunidad.peopleNeeded ||
      oportunidad.type === 'FORMAL_JOB' ||
      oportunidad.status !== 'ACTIVE' ||
      postulacion.status !== 'RECEIVED'
    ) {
      throw conflicto('SELECTION_NOT_AVAILABLE', 'La selección ya no está disponible');
    }
    const { scheduledAt, peopleNeeded } = oportunidad;
    const { trabajo, descartar, llena } = await transaccionSerializable(this.prisma, async (tx) => {
      const ahora = new Date();
      const cambio = await tx.selection.updateMany({
        where: { id, status: 'PENDING', expiresAt: { gt: ahora } },
        data: { status: 'ACCEPTED', respondedAt: ahora, termsAcceptedAt: ahora },
      });
      if (!cambio.count)
        throw conflicto('SELECTION_NOT_AVAILABLE', 'La selección ya fue respondida o venció');
      const trabajo = await tx.job.create({
        data: {
          selectionId: id,
          opportunityId: oportunidad.id,
          workerProfileId: postulacion.workerProfileId,
          scheduledAt,
        },
      });
      const aceptadas = await tx.job.count({
        where: { opportunityId: oportunidad.id, status: { not: 'CANCELLED' } },
      });
      const llena = aceptadas >= peopleNeeded;
      const descartar = [];
      if (llena) {
        const interesados = await this.postulaciones.listForOpportunity(oportunidad.id);
        const existentes = new Set(
          (await this.seleccionesDe(tx, interesados)).map(({ applicationId }) => applicationId),
        );
        descartar.push(
          ...interesados.filter(
            (interesado) => interesado.status === 'RECEIVED' && !existentes.has(interesado.id),
          ),
        );
      }
      return { trabajo, descartar, llena };
    });

    await this.postulaciones.setStatus(postulacion.id, 'ACCEPTED');
    if (llena) {
      await this.oportunidades.markFilled(oportunidad.id);
      await Promise.all(descartar.map(({ id }) => this.postulaciones.setStatus(id, 'REJECTED')));
    }
    await this.avisar([
      evento(oportunidad.publisherUserId, 'SELECTION_ACCEPTED', id),
      ...descartar.map(({ workerUserId, id }) =>
        evento(workerUserId, 'APPLICATION_STATUS_CHANGED', id),
      ),
    ]);
    return trabajo;
  }

  async rechazar(id: string, usuarioId: string) {
    const { oportunidad } = await this.seleccionPropia(id, usuarioId);
    const ahora = new Date();
    const cambio = await this.prisma.selection.updateMany({
      where: { id, status: 'PENDING', expiresAt: { gt: ahora } },
      data: { status: 'REJECTED', respondedAt: ahora },
    });
    if (!cambio.count)
      throw conflicto('SELECTION_NOT_AVAILABLE', 'La selección ya fue respondida o venció');
    await this.oportunidades.reopenIfFilled(oportunidad.id);
    await this.avisar([evento(oportunidad.publisherUserId, 'SELECTION_REJECTED', id)]);
  }

  async expireSelections(now: Date) {
    const pendientes = await this.prisma.selection.findMany({
      where: { status: 'PENDING', expiresAt: { lte: now } },
    });
    for (const { id, applicationId } of pendientes) {
      const cambio = await this.prisma.selection.updateMany({
        where: { id, status: 'PENDING', expiresAt: { lte: now } },
        data: { status: 'EXPIRED', respondedAt: now },
      });
      if (!cambio.count) continue;
      const postulacion = await this.postulaciones.getWithParties(applicationId);
      if (!postulacion) continue;
      const oportunidad = await this.oportunidades.getForEngagement(postulacion.opportunityId);
      if (!oportunidad) continue;
      await this.oportunidades.reopenIfFilled(oportunidad.id);
      await this.avisar([evento(oportunidad.publisherUserId, 'SELECTION_EXPIRED', id)]);
    }
  }

  startDueJobs(now: Date) {
    return this.prisma.job.updateMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
      data: { status: 'IN_PROGRESS' },
    });
  }

  private async partesDelTrabajo(trabajo: Job) {
    const [seleccion, oportunidad] = await Promise.all([
      this.prisma.selection.findUnique({ where: { id: trabajo.selectionId } }),
      this.oportunidades.getForEngagement(trabajo.opportunityId),
    ]);
    if (!oportunidad || !seleccion || seleccion.status !== 'ACCEPTED' || !seleccion.termsAcceptedAt)
      return null;
    const postulacion = await this.postulaciones.getWithParties(seleccion.applicationId);
    if (!postulacion) return null;
    return {
      trabajo,
      oportunidad,
      workerUserId: postulacion.workerUserId,
      publisherUserId: oportunidad.publisherUserId,
    };
  }

  async getJobParties(id: string) {
    const trabajo = await this.prisma.job.findUnique({ where: { id } });
    const partes = trabajo && (await this.partesDelTrabajo(trabajo));
    return (
      partes && {
        status: partes.trabajo.status,
        workerUserId: partes.workerUserId,
        publisherUserId: partes.publisherUserId,
      }
    );
  }

  private async trabajoPropio(id: string, usuarioId: string) {
    const trabajo = await this.prisma.job.findUnique({ where: { id } });
    const partes = trabajo && (await this.partesDelTrabajo(trabajo));
    if (!partes || ![partes.workerUserId, partes.publisherUserId].includes(usuarioId))
      throw noEncontrado();
    const contraparteId =
      partes.workerUserId === usuarioId ? partes.publisherUserId : partes.workerUserId;
    return { ...partes, contraparteId };
  }

  async trabajosPropios(usuarioId: string, { page, pageSize, role, state }: ListarTrabajosDto) {
    const estados: Job['status'][] =
      state === 'active' ? ['SCHEDULED', 'IN_PROGRESS'] : ['COMPLETED', 'CANCELLED'];
    const items = [];
    let cursor: string | undefined;
    let omitidos = (page - 1) * pageSize;
    let hasMore = false;
    // Los contratos actuales solo resuelven las partes por ID. Se consultan lotes de trabajos propios.
    do {
      const lote = await this.prisma.job.findMany({
        where: { status: { in: estados } },
        orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: 50,
      });
      if (!lote.length) break;
      const partes = await Promise.all(lote.map((trabajo) => this.partesDelTrabajo(trabajo)));
      for (const fila of partes) {
        if (!fila || (role === 'worker' ? fila.workerUserId : fila.publisherUserId) !== usuarioId)
          continue;
        if (omitidos > 0) {
          omitidos--;
          continue;
        }
        if (items.length === pageSize) {
          hasMore = true;
          break;
        }
        const contraparteId = role === 'worker' ? fila.publisherUserId : fila.workerUserId;
        const contacto = await this.identidad.getContact(contraparteId);
        const { title, type, zone } = fila.oportunidad;
        const { id, status, scheduledAt } = fila.trabajo;
        items.push({
          id,
          title,
          type,
          zone,
          status,
          scheduledAt,
          counterparty: { name: contacto?.name ?? null },
        });
      }
      cursor = lote.length === 50 ? lote.at(-1)?.id : undefined;
    } while (cursor && !hasMore);
    return { items, hasMore, page, pageSize };
  }

  async detalleTrabajo(id: string, usuarioId: string) {
    const { trabajo, oportunidad, contraparteId } = await this.trabajoPropio(id, usuarioId);
    const [counterparty, hasRated] = await Promise.all([
      this.identidad.getContact(contraparteId),
      this.reputacion.yaCalifico(id, usuarioId),
    ]);
    const { title, type, zone, exactAddress } = oportunidad;
    return { ...trabajo, title, type, zone, exactAddress, counterparty, hasRated };
  }

  async marcarTerminado(id: string, usuarioId: string) {
    const { contraparteId } = await this.trabajoPropio(id, usuarioId);
    const cambio = await this.prisma.job.updateMany({
      where: { id, status: 'IN_PROGRESS', finishMarkedById: null },
      data: { finishMarkedAt: new Date(), finishMarkedById: usuarioId },
    });
    if (cambio.count) {
      await this.avisar([evento(contraparteId, 'JOB_FINISH_MARKED', id)]);
      return;
    }
    const actual = await this.prisma.job.findUnique({ where: { id } });
    if (actual?.status === 'IN_PROGRESS' && actual.finishMarkedById === usuarioId) return;
    throw conflicto('JOB_FINISH_NOT_AVAILABLE', 'El trabajo no se puede marcar como terminado');
  }

  async confirmarTerminado(id: string, usuarioId: string) {
    const { trabajo, workerUserId, publisherUserId } = await this.trabajoPropio(id, usuarioId);
    if (trabajo.status !== 'IN_PROGRESS' || !trabajo.finishMarkedById) {
      throw conflicto(
        'JOB_FINISH_NOT_AVAILABLE',
        'El trabajo debe estar en curso y marcado como terminado',
      );
    }
    if (trabajo.finishMarkedById === usuarioId) {
      throw conflicto(
        'FINISH_NEEDS_OTHER_PARTY',
        'La otra parte debe confirmar la finalización del trabajo',
      );
    }
    await transaccionSerializable(this.prisma, async (tx) => {
      const cambio = await tx.job.updateMany({
        where: { id, status: 'IN_PROGRESS', finishMarkedById: trabajo.finishMarkedById },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      if (!cambio.count)
        throw conflicto('JOB_FINISH_NOT_AVAILABLE', 'El trabajo ya no se puede confirmar');
      await this.reputacion.recordCompletedJob(workerUserId, publisherUserId, tx);
    });
    await this.avisar(
      [workerUserId, publisherUserId].flatMap((usuario) => [
        evento(usuario, 'JOB_COMPLETED', id),
        evento(usuario, 'RATING_AVAILABLE', id),
      ]),
    );
  }

  async cancelarTrabajo(id: string, usuarioId: string, reason: string) {
    const { oportunidad, contraparteId } = await this.trabajoPropio(id, usuarioId);
    const cambio = await this.prisma.job.updateMany({
      where: { id, status: 'SCHEDULED' },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: usuarioId,
        cancelReason: reason,
      },
    });
    if (!cambio.count)
      throw conflicto('JOB_CANNOT_BE_CANCELLED', 'Solo puedes cancelar un trabajo programado');
    await this.oportunidades.reopenIfFilled(oportunidad.id);
    await this.avisar([evento(contraparteId, 'JOB_CANCELLED', id)]);
  }
}
