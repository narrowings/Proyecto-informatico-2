
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST', 'localhost');
    const port = Number(this.config.get<string>('SMTP_PORT', '1025'));

    this.from = this.config.get<string>(
      'MAIL_FROM',
      'Red de Oportunidades <no-reply@red-oportunidades.local>',
    );

    this.transporter = createTransport({
      host,
      port,
      secure: false,
    });
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };

      return entities[char];
    });
  }

  async sendConfirmationEmail(
    email: string,
    name: string,
    confirmationUrl: string,
  ): Promise<void> {
    const safeName = this.escapeHtml(name);

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Confirma tu correo electrónico',
      text: `Hola ${name}.

Gracias por registrarte en Red de Oportunidades Laborales.

Para activar tu cuenta, ingresa al siguiente enlace:

${confirmationUrl}

Este enlace tiene una vigencia de 24 horas.

Si no solicitaste esta cuenta, puedes ignorar este mensaje.`,
      html: `
        <h2>¡Bienvenido a Red de Oportunidades!</h2>
        <p>Hola ${safeName},</p>
        <p>Gracias por registrarte en nuestra plataforma.</p>
        <p>Para activar tu cuenta, haz clic en el siguiente enlace:</p>
        <p>
          <a href="${confirmationUrl}">
            Confirmar mi correo electrónico
          </a>
        </p>
        <p>Este enlace tiene una vigencia de 24 horas.</p>
        <p>Si no solicitaste esta cuenta, puedes ignorar este mensaje.</p>
      `,
    });
  }
}
