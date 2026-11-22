import type { ConfigService } from '@nestjs/config';

// T-04: con SMTP_HOST configurado los correos se envían de verdad (Mailpit en local, Brevo/Gmail en QA).
export const sendsRealEmail = (config: ConfigService) =>
  Boolean(config.get<string>('SMTP_HOST')?.trim());

// Sin SMTP los correos se escriben en el log. Fuera de desarrollo el log NUNCA lleva el enlace:
// contiene un token que permite confirmar la cuenta o cambiar la contraseña de otra persona
// (auditoría de seguridad, hallazgo alto).
export const logsEmailLinks = (config: ConfigService) =>
  config.get<string>('NODE_ENV') === 'development';

// "ana@correo.com" → "a***@correo.com": identifica el caso sin exponer el correo completo.
export const maskEmail = (email: string) => {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
};

// Errores de nodemailer: solo el código (ECONNECTION, EAUTH…). El mensaje y la respuesta del
// servidor SMTP pueden traer el correo del destinatario, así que nunca se escriben en el log.
export const mailErrorCode = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code) ? code : 'DESCONOCIDO';
};
