import { Injectable, Logger } from '@nestjs/common';

export interface ConfirmationMail {
  to: string;
  name: string;
  link: string;
}

// Puerto de salida del correo de confirmación. T-04 (Santiago López) registra la implementación
// real con plantillas (Mailpit en local, SES en producción) en lugar de LoggerConfirmationMailer.
export abstract class ConfirmationMailer {
  abstract send(mail: ConfirmationMail): Promise<void>;
}

// Solo para desarrollo mientras llega T-04: escribe el enlace en el log sin el correo del usuario.
@Injectable()
export class LoggerConfirmationMailer extends ConfirmationMailer {
  private readonly logger = new Logger('ConfirmationMailer');

  async send({ link }: ConfirmationMail) {
    this.logger.warn(`Correo de confirmación sin enviar (T-04 pendiente). Enlace: ${link}`);
  }
}
