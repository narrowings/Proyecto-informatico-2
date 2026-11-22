import { Global, Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { notificationMailerProvider } from './notification-mailer';
import { NOTIFICATIONS } from './notifications.contract';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  imports: [PrismaModule, IdentityModule, MailModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    notificationMailerProvider,
    { provide: NOTIFICATIONS, useExisting: NotificationsService },
  ],
  exports: [NOTIFICATIONS],
})
export class NotificationsModule {}
