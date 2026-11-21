import type { ConfigService } from '@nestjs/config';

// Mientras no exista el correo real (T-04), los correos se escriben en el log. Fuera de desarrollo
// el log NUNCA lleva el enlace: contiene un token que permite confirmar la cuenta o cambiar la
// contraseña de otra persona (auditoría de seguridad, hallazgo alto).
export const logsEmailLinks = (config: ConfigService) =>
  config.get<string>('NODE_ENV') === 'development';

// "ana@correo.com" → "a***@correo.com": identifica el caso sin exponer el correo completo.
export const maskEmail = (email: string) => {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
};
