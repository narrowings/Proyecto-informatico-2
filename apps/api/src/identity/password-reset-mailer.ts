import { Injectable, Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logsEmailLinks, maskEmail } from '../common/mail/pending-mail';

export type PasswordResetMail = { to: string; name: string; link: string };

// Puerto de salida del correo de recuperación (HU-018). T-04 registra la implementación real en
// passwordResetMailerProvider.
export abstract class PasswordResetMailer {
  abstract send(email: PasswordResetMail): Promise<void>;
}

// Solo en desarrollo: escribe el enlace en el log para probar la recuperación sin correo.
@Injectable()
export class LoggerPasswordResetMailer extends PasswordResetMailer {
  private readonly logger = new Logger(PasswordResetMailer.name);

  async send({ link }: PasswordResetMail) {
    this.logger.warn(`Correo de recuperación pendiente de envío. Enlace: ${link}`);
  }
}

// QA y producción mientras llega T-04: el enlace permite cambiar la contraseña, así que no se escribe.
@Injectable()
export class RedactedPasswordResetMailer extends PasswordResetMailer {
  private readonly logger = new Logger(PasswordResetMailer.name);

  async send({ to }: PasswordResetMail) {
    this.logger.warn(`Correo de recuperación sin enviar a ${maskEmail(to)} (T-04 pendiente)`);
  }
}

export const passwordResetMailerProvider: Provider = {
  provide: PasswordResetMailer,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    logsEmailLinks(config) ? new LoggerPasswordResetMailer() : new RedactedPasswordResetMailer(),
};
