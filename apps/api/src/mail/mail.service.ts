import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const DEFAULT_MAIL_FROM = 'Red de Oportunidades <no-reply@red-oportunidades.local>';

// Un SMTP caído no debe dejar colgado el registro esperando los 2 minutos por defecto de nodemailer.
const TIMEOUT_MS = 10_000;

// Envía correos por SMTP: Mailpit en local, Brevo/Gmail en QA. Solo se usa cuando hay SMTP_HOST
// (ver common/mail/pending-mail.ts). No escribe en el log: los errores suben a quien llama.
@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const user = config.get<string>('SMTP_USER')?.trim();
    const secure = config.get<string>('SMTP_SECURE')?.trim().toLowerCase() === 'true';

    this.from = config.get<string>('MAIL_FROM')?.trim() || DEFAULT_MAIL_FROM;
    this.transporter = createTransport({
      host: config.get<string>('SMTP_HOST')?.trim() || 'localhost',
      port: Number(config.get<string>('SMTP_PORT') || (secure ? 465 : 587)),
      // 465 → secure (TLS desde el inicio). 587 → STARTTLS. 1025 → Mailpit, sin TLS.
      secure,
      // Con credenciales y sin TLS implícito se exige STARTTLS: la clave nunca viaja en claro.
      requireTLS: Boolean(user) && !secure,
      ...(user ? { auth: { user, pass: config.get<string>('SMTP_PASS') ?? '' } } : {}),
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });
  }

  async send({ to, subject, text, html }: OutgoingMail): Promise<void> {
    await this.transporter.sendMail({ from: this.from, to, subject, text, html });
  }
}
