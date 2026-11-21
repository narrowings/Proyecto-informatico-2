import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

// Cabeceras de seguridad (auditoría, hallazgo bajo): quita X-Powered-By y agrega nosniff, HSTS,
// frame-ancestors 'none', Referrer-Policy, etc. Cross-Origin-Resource-Policy en "same-site" para
// que la web (otro puerto u otro subdominio del mismo sitio) pueda mostrar las fotos del API.
export const applySecurityHeaders = (app: NestExpressApplication) => {
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
};
