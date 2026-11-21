import { Injectable, Logger } from '@nestjs/common';

interface NotificationEmail {
  to: string;
  name: string;
  subject: string;
  text: string;
  link: string;
}

export abstract class NotificationMailer {
  abstract send(email: NotificationEmail): Promise<void>;
}

// Implementación provisional hasta conectar el correo transaccional (T-04).
@Injectable()
export class LoggerNotificationMailer extends NotificationMailer {
  private readonly logger = new Logger(NotificationMailer.name);

  async send({ subject, text, link }: NotificationEmail) {
    this.logger.log({ message: 'Correo de notificación pendiente de envío', subject, text, link });
  }
}
