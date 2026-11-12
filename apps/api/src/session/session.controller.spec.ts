import { type INestApplication, Module, UnauthorizedException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RATE_LIMIT_MESSAGE, rateLimitOptions } from '../common/http/rate-limit';
import { applyTrustProxy } from '../common/http/trust-proxy';
import { validationPipe } from '../common/validation';
import { INVALID_CREDENTIALS } from './session.constants';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';

// Controlador sobre HTTP real: límite de intentos, IP detrás del proxy y cookie de refresco.
// El servicio va simulado; su lógica se prueba en session.service.spec.ts.

let app: INestApplication | undefined;

const start = async (nodeEnv = 'production') => {
  vi.stubEnv('NODE_ENV', nodeEnv);
  const session = {
    login: vi.fn().mockResolvedValue({
      accessToken: 'jwt',
      expiresIn: 900,
      refreshToken: 'opaco',
      user: { id: 'u1', name: 'Ana', email: 'ana@correo.com' },
    }),
    refresh: vi.fn().mockResolvedValue({ accessToken: 'jwt2', expiresIn: 900, refreshToken: 'opaco2' }),
    logout: vi.fn().mockResolvedValue(undefined),
    me: vi.fn(),
  };

  @Module({
    imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), ThrottlerModule.forRoot(rateLimitOptions)],
    controllers: [SessionController],
    providers: [{ provide: SessionService, useValue: session }],
  })
  class TestModule {}

  const nest = await NestFactory.create<NestExpressApplication>(TestModule, { logger: false });
  applyTrustProxy(nest, 1);
  nest.setGlobalPrefix('v1');
  nest.useGlobalPipes(validationPipe);
  await nest.listen(0, '127.0.0.1');
  app = nest;
  return { session, base: `${await nest.getUrl()}/v1/auth` };
};

afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.unstubAllEnvs();
});

const post = (url: string, clientIp: string, body?: object, cookie?: string) =>
  fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': clientIp,
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const credentials = { email: 'ana@correo.com', password: 'Segura123' };
const CLIENT = '181.50.10.20';

describe('SessionController: límite de intentos (RNF-SEG-08, revisión PR #5 3.1)', () => {
  it('login: permite 5 intentos por minuto y al sexto responde 429 con Retry-After', async () => {
    const { base } = await start();
    for (let i = 0; i < 5; i++) {
      expect((await post(`${base}/login`, CLIENT, credentials)).status).toBe(200);
    }
    const blocked = await post(`${base}/login`, CLIENT, credentials);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after-ip'))).toBeGreaterThan(0);
    expect(Number(blocked.headers.get('retry-after-ip'))).toBeLessThanOrEqual(60);
    expect(await blocked.json()).toMatchObject({ message: RATE_LIMIT_MESSAGE });
  });

  it('login: los intentos fallidos también cuentan', async () => {
    const { base, session } = await start();
    session.login.mockRejectedValue(new UnauthorizedException(INVALID_CREDENTIALS));
    for (let i = 0; i < 5; i++) {
      expect((await post(`${base}/login`, CLIENT, credentials)).status).toBe(401);
    }
    expect((await post(`${base}/login`, CLIENT, credentials)).status).toBe(429);
  });

  it('login: no limita por correo, para que un tercero no pueda bloquear la cuenta de otra persona', async () => {
    const { base } = await start();
    for (let i = 0; i < 5; i++) {
      expect((await post(`${base}/login`, `181.50.10.${i}`, credentials)).status).toBe(200);
    }
  });

  it('login: cuenta por la IP real del cliente detrás del proxy, no por la del proxy (3.2)', async () => {
    const { base, session } = await start();
    for (let i = 0; i < 5; i++) await post(`${base}/login`, CLIENT, credentials);
    expect((await post(`${base}/login`, CLIENT, credentials)).status).toBe(429);

    const other = await post(`${base}/login`, '1.1.1.1, 190.0.0.9', credentials);
    expect(other.status).toBe(200);
    expect(session.login).toHaveBeenLastCalledWith(credentials, {
      ip: '190.0.0.9',
      userAgent: expect.any(String),
    });
  });

  it('refresh: permite 10 renovaciones por minuto y la undécima responde 429', async () => {
    const { base } = await start();
    for (let i = 0; i < 10; i++) {
      expect((await post(`${base}/refresh`, CLIENT, undefined, 'refresh_token=x')).status).toBe(200);
    }
    expect((await post(`${base}/refresh`, CLIENT, undefined, 'refresh_token=x')).status).toBe(429);
  });

  it('login y refresh llevan contadores separados', async () => {
    const { base } = await start();
    for (let i = 0; i < 5; i++) await post(`${base}/login`, CLIENT, credentials);
    expect((await post(`${base}/login`, CLIENT, credentials)).status).toBe(429);
    expect((await post(`${base}/refresh`, CLIENT, undefined, 'refresh_token=x')).status).toBe(200);
  });

  it('logout no tiene límite: cerrar sesión siempre debe funcionar', async () => {
    const { base } = await start();
    for (let i = 0; i < 12; i++) {
      expect((await post(`${base}/logout`, CLIENT)).status).toBe(204);
    }
  });
});

describe('SessionController: cookie de refresco (revisión PR #5 3.3)', () => {
  const refreshCookie = (response: Response) =>
    response.headers.getSetCookie().find((c) => c.startsWith('refresh_token=')) ?? '';

  it('fuera de desarrollo (QA, producción) la cookie lleva Secure', async () => {
    const { base } = await start('production');
    const cookie = refreshCookie(await post(`${base}/login`, CLIENT, credentials));
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/v1/auth');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('en desarrollo local (http://localhost) la cookie no lleva Secure', async () => {
    const { base } = await start('development');
    const cookie = refreshCookie(await post(`${base}/login`, CLIENT, credentials));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).not.toContain('Secure');
  });
});
