import type { ThrottlerModuleOptions } from '@nestjs/throttler';

// RNF-SEG-08: límite de peticiones en los endpoints públicos que crean cuentas o envían correos.
// Se aplica por ruta con @UseGuards(ThrottlerGuard) y @Throttle; no es global para no afectar otras
// rutas. El conteo vive en memoria: alcanza para una sola instancia de la API (QA).
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MESSAGE =
  'Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo';

const emailFromBody = (req: Record<string, unknown>) => {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : undefined;
};

export const rateLimitOptions: ThrottlerModuleOptions = {
  errorMessage: RATE_LIMIT_MESSAGE,
  throttlers: [
    // Por IP del cliente (req.ip, ver trust-proxy.ts).
    { name: 'ip', ttl: RATE_LIMIT_WINDOW_MS, limit: 5 },
    // Por correo destino: frena el envío repetido a una misma bandeja aunque cambie la IP.
    {
      name: 'email',
      ttl: RATE_LIMIT_WINDOW_MS,
      limit: 3,
      getTracker: (req) => emailFromBody(req) ?? String(req.ip),
    },
  ],
};
