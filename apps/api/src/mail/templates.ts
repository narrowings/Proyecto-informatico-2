import { escapeHtml } from './escape-html';

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

const PLATFORM = 'Red de Oportunidades Laborales';

// Estructura común del HTML. Recibe fragmentos ya escapados; solo `button` escapa su enlace y texto.
const layout = (title: string, paragraphs: string[], button: { label: string; link: string }) => `
<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;">${title}</h1>
      ${paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.5;">${p}</p>`).join('\n      ')}
      <p style="margin:24px 0;">
        <a href="${escapeHtml(button.link)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;">${escapeHtml(button.label)}</a>
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#52525b;line-height:1.5;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br>${escapeHtml(button.link)}</p>
      <p style="margin:24px 0 0;font-size:12px;color:#71717a;">${PLATFORM}</p>
    </div>
  </body>
</html>`;

// HU-001: el enlace vence en 24 horas (CONFIRMATION_TTL_MS).
export const confirmationEmail = ({ name, link }: { name: string; link: string }): MailContent => ({
  subject: 'Confirma tu correo electrónico',
  text: `Hola ${name}:

Gracias por registrarte en ${PLATFORM}.

Para activar tu cuenta, ingresa al siguiente enlace:

${link}

Este enlace tiene una vigencia de 24 horas.

Si no solicitaste esta cuenta, puedes ignorar este mensaje.`,
  html: layout(
    '¡Bienvenido a Red de Oportunidades!',
    [
      `Hola ${escapeHtml(name)}:`,
      'Gracias por registrarte en nuestra plataforma. Para activar tu cuenta, confirma tu correo electrónico.',
      'Este enlace tiene una vigencia de 24 horas.',
      'Si no solicitaste esta cuenta, puedes ignorar este mensaje.',
    ],
    { label: 'Confirmar mi correo electrónico', link },
  ),
});

// HU-018: el enlace vence en 30 minutos (PASSWORD_RESET_TTL_MS) y sirve una sola vez.
export const passwordResetEmail = ({
  name,
  link,
}: {
  name: string;
  link: string;
}): MailContent => ({
  subject: 'Restablece tu contraseña',
  text: `Hola ${name}:

Recibimos una solicitud para restablecer la contraseña de tu cuenta en ${PLATFORM}.

Para crear una contraseña nueva, ingresa al siguiente enlace:

${link}

Este enlace tiene una vigencia de 30 minutos y solo se puede usar una vez.

Si no solicitaste este cambio, ignora este mensaje: tu contraseña actual sigue funcionando.`,
  html: layout(
    'Restablece tu contraseña',
    [
      `Hola ${escapeHtml(name)}:`,
      `Recibimos una solicitud para restablecer la contraseña de tu cuenta en ${PLATFORM}.`,
      'Este enlace tiene una vigencia de 30 minutos y solo se puede usar una vez.',
      'Si no solicitaste este cambio, ignora este mensaje: tu contraseña actual sigue funcionando.',
    ],
    { label: 'Restablecer mi contraseña', link },
  ),
});

// Avisos de la bandeja: asunto = título de la notificación, cuerpo = su texto.
export const notificationEmail = ({
  name,
  subject,
  text,
  link,
}: {
  name: string;
  subject: string;
  text: string;
  link: string;
}): MailContent => ({
  subject,
  text: `Hola ${name}:

${text}

Ver en la plataforma: ${link}`,
  html: layout(escapeHtml(subject), [`Hola ${escapeHtml(name)}:`, escapeHtml(text)], {
    label: 'Ver en la plataforma',
    link,
  }),
});
