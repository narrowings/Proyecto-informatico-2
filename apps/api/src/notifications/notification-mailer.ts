import { Injectable, Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logsEmailLinks, maskEmail, sendsRealEmail } from '../common/mail/pending-mail';
import { MailService } from '../mail/mail.service';
import { notificationEmail } from '../mail/templates';

export interface NotificationEmail {
  to: string;
  name: string;
  subject: string;
  text: string;
  link: string;
}

// Puerto de salida de los avisos por correo. La implementación se elige en notificationMailerProvider.
export abstract class NotificationMailer {
  abstract send(email: NotificationEmail): Promise<void>;
}

// T-04: envío real por SMTP. No captura errores: NotificationsService los registra sin detalles.
@Injectable()
export class SmtpNotificationMailer extends NotificationMailer {
  constructor(private readonly mail: MailService) {
    super();
  }

  send({ to, name, subject, text, link }: NotificationEmail) {
    return this.mail.send({ to, ...notificationEmail({ name, subject, text, link }) });
  }
}

// Sin SMTP, solo en desarrollo: escribe el aviso en el log.
@Injectable()
export class LoggerNotificationMailer extends NotificationMailer {
  private readonly logger = new Logger(NotificationMailer.name);

  async send({ subject, text, link }: NotificationEmail) {
    this.logger.log({
      message: 'Correo de notificación sin enviar (sin SMTP_HOST)',
      subject,
      text,
      link,
    });
  }
}

// Sin SMTP fuera de desarrollo: deja constancia sin el contenido, el enlace ni el correo completo.
@Injectable()
export class RedactedNotificationMailer extends NotificationMailer {
  private readonly logger = new Logger(NotificationMailer.name);

  async send({ to }: NotificationEmail) {
    this.logger.warn(`Correo de notificación sin enviar a ${maskEmail(to)} (sin SMTP_HOST)`);
  }
}

export const notificationMailerProvider: Provider = {
  provide: NotificationMailer,
  inject: [ConfigService, MailService],
  useFactory: (config: ConfigService, mail: MailService) => {
    if (sendsRealEmail(config)) return new SmtpNotificationMailer(mail);
    return logsEmailLinks(config)
      ? new LoggerNotificationMailer()
      : new RedactedNotificationMailer();
  },
};
