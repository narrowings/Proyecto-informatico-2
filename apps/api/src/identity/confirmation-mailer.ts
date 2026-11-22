import { Injectable, Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logsEmailLinks, maskEmail } from '../common/mail/pending-mail';

export interface ConfirmationMail {
  to: string;
  name: string;
  link: string;
}

// Puerto de salida del correo de confirmación. T-04 (Santiago López) registra la implementación
// real con plantillas (Mailpit en local, SES en producción) en confirmationMailerProvider.
export abstract class ConfirmationMailer {
  abstract send(mail: ConfirmationMail): Promise<void>;
}

// Solo en desarrollo: escribe el enlace en el log para poder confirmar cuentas sin correo.
@Injectable()
export class LoggerConfirmationMailer extends ConfirmationMailer {
  private readonly logger = new Logger('ConfirmationMailer');

  async send({ link }: ConfirmationMail) {
    this.logger.warn(`Correo de confirmación sin enviar (T-04 pendiente). Enlace: ${link}`);
  }
}

// QA y producción mientras llega T-04: deja constancia sin el enlace ni el correo completo.
@Injectable()
export class RedactedConfirmationMailer extends ConfirmationMailer {
  private readonly logger = new Logger('ConfirmationMailer');

  async send({ to }: ConfirmationMail) {
    this.logger.warn(`Correo de confirmación sin enviar a ${maskEmail(to)} (T-04 pendiente)`);
  }
}

export const confirmationMailerProvider: Provider = {
  provide: ConfirmationMailer,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    logsEmailLinks(config) ? new LoggerConfirmationMailer() : new RedactedConfirmationMailer(),
};
