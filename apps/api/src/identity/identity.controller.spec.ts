import { type INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RATE_LIMIT_MESSAGE, rateLimitOptions } from '../common/http/rate-limit';
import { applyTrustProxy, trustedProxyHops } from '../common/http/trust-proxy';
import { validationPipe } from '../common/validation';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

const body = {
  name: 'Ana Gómez',
  email: 'ana@correo.com',
  phone: '3001234567',
  password: 'Segura123',
  consents: { terms: '0.1', privacy: '0.1', dataProcessing: '0.1', isAdult: true },
};

describe('IdentityController (HTTP)', () => {
  let app: INestApplication;
  let url: string;
  const identity = {
    register: vi.fn().mockResolvedValue({ id: 'u1' }),
    resendConfirmation: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    @Module({
      imports: [ThrottlerModule.forRoot(rateLimitOptions)],
      controllers: [IdentityController],
      providers: [{ provide: IdentityService, useValue: identity }],
    })
    class TestModule {}

    const nest = await NestFactory.create<NestExpressApplication>(TestModule, { logger: false });
    applyTrustProxy(nest, 1);
    nest.useGlobalPipes(validationPipe);
    // Vitest no emite la metadata de tipos de Nest: se inyecta el servicio a mano.
    Object.assign(nest.get(IdentityController), { identity });
    await nest.listen(0, '127.0.0.1');
    app = nest;
    url = await nest.getUrl();
    vi.clearAllMocks();
  });

  afterEach(() => app.close());

  const post = (path: string, payload: object, clientIp: string) =>
    fetch(`${url}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': clientIp },
      body: JSON.stringify(payload),
    });

  it('3.1 Ley 1581: guarda la IP real del cliente que envía el proxy, no la del proxy', async () => {
    // Un cliente que intenta falsificar su IP queda a la izquierda; el proxy agrega la real al final.
    await post('/auth/register', body, '1.1.1.1, 181.50.10.20');

    expect(identity.register).toHaveBeenCalledWith(expect.anything(), '181.50.10.20');
  });

  it('RNF-SEG-08: máximo 5 registros por IP cada 15 minutos', async () => {
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await post('/auth/register', body, '181.50.10.20')).status);
    }
    const otherIp = await post('/auth/register', body, '181.50.10.21');

    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
    expect(otherIp.status).toBe(201);
    expect(identity.register).toHaveBeenCalledTimes(6);
  });

  it('RNF-SEG-08: máximo 3 reenvíos por correo aunque cambie la IP', async () => {
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      const res = await post(
        '/auth/resend-confirmation',
        { email: 'Ana@Correo.com' },
        `10.0.0.${i}`,
      );
      statuses.push(res.status);
    }
    const blocked = await post(
      '/auth/resend-confirmation',
      { email: 'ana@correo.com' },
      '10.0.0.9',
    );

    expect(statuses).toEqual([202, 202, 202, 429]);
    expect(await blocked.json()).toMatchObject({ statusCode: 429, message: RATE_LIMIT_MESSAGE });
    expect(identity.resendConfirmation).toHaveBeenCalledTimes(3);
  });

  it('RNF-SEG-08: máximo 3 reenvíos por IP con correos distintos', async () => {
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      const res = await post(
        '/auth/resend-confirmation',
        { email: `u${i}@correo.com` },
        '10.0.0.1',
      );
      statuses.push(res.status);
    }

    expect(statuses).toEqual([202, 202, 202, 429]);
  });
});

describe('trustedProxyHops', () => {
  it.each([
    [undefined, 1],
    ['0', 0],
    ['2', 2],
    ['-1', 1],
    ['abc', 1],
  ])('TRUSTED_PROXY_HOPS=%s → %d', (value, hops) => {
    expect(trustedProxyHops(value)).toBe(hops);
  });
});
