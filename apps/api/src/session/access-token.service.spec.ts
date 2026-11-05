import type { ConfigService } from '@nestjs/config';
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { AccessTokenService } from './access-token.service';
import { ACCESS_TTL_SECONDS, TOKEN_ISSUER } from './session.constants';

const SECRET = 'a'.repeat(32);

const configWith = (secret: string | undefined) =>
  ({
    getOrThrow: () => {
      if (secret === undefined) throw new Error('JWT_SECRET no definido');
      return secret;
    },
  }) as unknown as ConfigService;

const service = () => new AccessTokenService(configWith(SECRET));

describe('AccessTokenService', () => {
  it('HU-021: firma un token que verify devuelve como el id del usuario', async () => {
    const svc = service();

    const { token, expiresIn } = await svc.sign('u1');

    expect(expiresIn).toBe(ACCESS_TTL_SECONDS);
    expect(await svc.verify(token)).toBe('u1');
  });

  it('rechaza un token manipulado', async () => {
    const svc = service();
    const { token } = await svc.sign('u1');

    expect(await svc.verify(`${token}x`)).toBeNull();
  });

  it('rechaza un token firmado con otro secreto', async () => {
    const other = new AccessTokenService(configWith('b'.repeat(32)));
    const { token } = await other.sign('u1');

    expect(await service().verify(token)).toBeNull();
  });

  it('rechaza un token vencido', async () => {
    const key = new TextEncoder().encode(SECRET);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u1')
      .setIssuer(TOKEN_ISSUER)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);

    expect(await service().verify(expired)).toBeNull();
  });

  it('rechaza un token de otro emisor', async () => {
    const key = new TextEncoder().encode(SECRET);
    const foreign = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u1')
      .setIssuer('otro-emisor')
      .setExpirationTime('5m')
      .sign(key);

    expect(await service().verify(foreign)).toBeNull();
  });

  it('rechaza basura que no es un JWT', async () => {
    expect(await service().verify('no-es-un-jwt')).toBeNull();
  });

  it('exige JWT_SECRET de al menos 32 caracteres', () => {
    expect(() => new AccessTokenService(configWith('corto'))).toThrow(/32/);
  });

  it('falla si JWT_SECRET no está definido', () => {
    expect(() => new AccessTokenService(configWith(undefined))).toThrow();
  });
});
