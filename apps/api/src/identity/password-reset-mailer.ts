import { Injectable, Logger } from '@nestjs/common';

export abstract class PasswordResetMailer {
  abstract send(correo: { to: string; name: string; link: string }): Promise<void>;
}

// Implementación provisional de desarrollo mientras se conecta el correo transaccional.
@Injectable()
export class LoggerPasswordResetMailer extends PasswordResetMailer {
  private readonly logger = new Logger(PasswordResetMailer.name);

  async send({ link }: { link: string }) {
    this.logger.warn(`Correo de recuperación pendiente de envío. Enlace: ${link}`);
  }
}
