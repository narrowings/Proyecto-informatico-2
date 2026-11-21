import { Global, Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LoggerNotificationMailer, NotificationMailer } from './notification-mailer';
import { NOTIFICATIONS } from './notifications.contract';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: NotificationMailer, useClass: LoggerNotificationMailer },
    { provide: NOTIFICATIONS, useExisting: NotificationsService },
  ],
  exports: [NOTIFICATIONS],
})
export class NotificationsModule {}
