import { Global, Inject, Injectable, Logger, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATIONS,
  type NotificationsContract,
  type NotifyInput,
} from './notifications.contract';

@Injectable()
export class PersistentNotificationsService implements NotificationsContract {
  private readonly logger = new Logger(PersistentNotificationsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  notify(input: NotifyInput) {
    return this.notifyMany([input]);
  }

  async notifyMany(inputs: NotifyInput[]) {
    if (!inputs.length) return;
    try {
      await this.prisma.notification.createMany({ data: inputs });
    } catch {
      this.logger.error('No se pudieron guardar las notificaciones');
    }
  }
}

@Global()
@Module({
  imports: [PrismaModule],
  providers: [{ provide: NOTIFICATIONS, useClass: PersistentNotificationsService }],
  exports: [NOTIFICATIONS],
})
export class NotificationsModule {}
