import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotifyInput } from './notifications.contract';
import { PersistentNotificationsService } from './notifications.module';

describe('HU-014 Notificaciones provisionales', () => {
  it('guarda la fila y no propaga un fallo de persistencia', async () => {
    const createMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error('Sin conexión'));
    const service = new PersistentNotificationsService({
      notification: { createMany },
    } as unknown as PrismaService);
    const event: NotifyInput = {
      userId: 'u',
      type: 'JOB_COMPLETED',
      title: 'Trabajo completado',
      body: 'Ya puedes calificar',
      link: '/mi-actividad',
      data: { recursoId: 't' },
    };
    await service.notify(event);
    expect(createMany).toHaveBeenCalledWith({ data: [event] });
    await expect(service.notifyMany([event])).resolves.toBeUndefined();
  });
});
