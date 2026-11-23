import { Injectable, Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logsEmailLinks, maskEmail, sendsRealEmail } from '../common/mail/pending-mail';
import { MailService } from '../mail/mail.service';
import { passwordResetEmail } from '../mail/templates';

export type PasswordResetMail = { to: string; name: string; link: string };

// Puerto de salida del correo de recuperación (HU-018). La implementación se elige en
// passwordResetMailerProvider.
export abstract class PasswordResetMailer {
  abstract send(email: PasswordResetMail): Promise<void>;
}

// T-04: envío real por SMTP. No captura errores: PasswordResetService los registra sin detalles.
@Injectable()
export class SmtpPasswordResetMailer extends PasswordResetMailer {
  constructor(private readonly mail: MailService) {
    super();
  }

  send({ to, name, link }: PasswordResetMail) {
    return this.mail.send({ to, ...passwordResetEmail({ name, link }) });
  }
}

// Sin SMTP, solo en desarrollo: escribe el enlace en el log para probar la recuperación.
@Injectable()
export class LoggerPasswordResetMailer extends PasswordResetMailer {
  private readonly logger = new Logger(PasswordResetMailer.name);

  async send({ link }: PasswordResetMail) {
    this.logger.warn(`Correo de recuperación sin enviar (sin SMTP_HOST). Enlace: ${link}`);
  }
}

// Sin SMTP fuera de desarrollo: el enlace permite cambiar la contraseña, así que no se escribe.
@Injectable()
export class RedactedPasswordResetMailer extends PasswordResetMailer {
  private readonly logger = new Logger(PasswordResetMailer.name);

  async send({ to }: PasswordResetMail) {
    this.logger.warn(`Correo de recuperación sin enviar a ${maskEmail(to)} (sin SMTP_HOST)`);
  }
}

export const passwordResetMailerProvider: Provider = {
  provide: PasswordResetMailer,
  inject: [ConfigService, MailService],
  useFactory: (config: ConfigService, mail: MailService) => {
    if (sendsRealEmail(config)) return new SmtpPasswordResetMailer(mail);
    return logsEmailLinks(config)
      ? new LoggerPasswordResetMailer()
      : new RedactedPasswordResetMailer();
  },
};
