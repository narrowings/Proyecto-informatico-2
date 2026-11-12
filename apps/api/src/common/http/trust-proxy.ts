import type { NestExpressApplication } from '@nestjs/platform-express';

// Ley 1581 de 2012: la constancia del consentimiento debe guardar la IP real del usuario, no la del
// proxy. Con `trust proxy` Express toma `req.ip` de X-Forwarded-For descontando los proxies propios,
// y el rate limiting también cuenta por esa IP.
// QA (ADR-08): Cloudflare → cloudflared → API = 1 salto. Producción (CloudFront + ALB) = 2 saltos.
// Sin proxy delante usar 0: si no, un cliente podría falsificar su IP con X-Forwarded-For.
export const DEFAULT_TRUSTED_PROXY_HOPS = 1;

export const trustedProxyHops = (value = process.env.TRUSTED_PROXY_HOPS) => {
  const hops = Number(value ?? DEFAULT_TRUSTED_PROXY_HOPS);
  return Number.isInteger(hops) && hops >= 0 ? hops : DEFAULT_TRUSTED_PROXY_HOPS;
};

export const applyTrustProxy = (app: NestExpressApplication, hops = trustedProxyHops()) => {
  app.set('trust proxy', hops);
};
