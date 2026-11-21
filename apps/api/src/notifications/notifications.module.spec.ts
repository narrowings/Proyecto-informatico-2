import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotifyInput } from './notifications.contract';
import { NotificacionesPersistentes } from './notifications.module';

describe('HU-014 Notificaciones provisionales', () => {
  it('guarda la fila y no propaga un fallo de persistencia', async () => {
    const createMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error('Sin conexión'));
    const servicio = new NotificacionesPersistentes({
      notification: { createMany },
    } as unknown as PrismaService);
    const evento: NotifyInput = {
      userId: 'u',
      type: 'JOB_COMPLETED',
      title: 'Trabajo completado',
      body: 'Ya puedes calificar',
      link: '/mi-actividad',
      data: { recursoId: 't' },
    };
    await servicio.notify(evento);
    expect(createMany).toHaveBeenCalledWith({ data: [evento] });
    await expect(servicio.notifyMany([evento])).resolves.toBeUndefined();
  });
});
