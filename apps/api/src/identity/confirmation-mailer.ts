import { Injectable, Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logsEmailLinks, maskEmail, sendsRealEmail } from '../common/mail/pending-mail';
import { MailService } from '../mail/mail.service';
import { confirmationEmail } from '../mail/templates';

export interface ConfirmationMail {
  to: string;
  name: string;
  link: string;
}

// Puerto de salida del correo de confirmación (HU-001). La implementación se elige en
// confirmationMailerProvider.
export abstract class ConfirmationMailer {
  abstract send(mail: ConfirmationMail): Promise<void>;
}

// T-04: envío real por SMTP. No captura errores: IdentityService decide qué registrar.
@Injectable()
export class SmtpConfirmationMailer extends ConfirmationMailer {
  constructor(private readonly mail: MailService) {
    super();
  }

  send({ to, name, link }: ConfirmationMail) {
    return this.mail.send({ to, ...confirmationEmail({ name, link }) });
  }
}

// Sin SMTP, solo en desarrollo: escribe el enlace en el log para poder confirmar cuentas.
@Injectable()
export class LoggerConfirmationMailer extends ConfirmationMailer {
  private readonly logger = new Logger('ConfirmationMailer');

  async send({ link }: ConfirmationMail) {
    this.logger.warn(`Correo de confirmación sin enviar (sin SMTP_HOST). Enlace: ${link}`);
  }
}

// Sin SMTP fuera de desarrollo: deja constancia sin el enlace ni el correo completo.
@Injectable()
export class RedactedConfirmationMailer extends ConfirmationMailer {
  private readonly logger = new Logger('ConfirmationMailer');

  async send({ to }: ConfirmationMail) {
    this.logger.warn(`Correo de confirmación sin enviar a ${maskEmail(to)} (sin SMTP_HOST)`);
  }
}

export const confirmationMailerProvider: Provider = {
  provide: ConfirmationMailer,
  inject: [ConfigService, MailService],
  useFactory: (config: ConfigService, mail: MailService) => {
    if (sendsRealEmail(config)) return new SmtpConfirmationMailer(mail);
    return logsEmailLinks(config)
      ? new LoggerConfirmationMailer()
      : new RedactedConfirmationMailer();
  },
};
