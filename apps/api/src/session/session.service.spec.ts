import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hashToken } from '../identity/tokens';
import type { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenService } from './access-token.service';
import type { LoginDto } from './dto/login.dto';
import { REFRESH_TTL_MS } from './session.constants';
import { SessionService } from './session.service';

const PASSWORD = 'Segura123';
const meta = { ip: '10.0.0.1', userAgent: 'vitest' };
const dto: LoginDto = { email: 'ana@correo.com', password: PASSWORD };

let passwordHash: string;
beforeAll(async () => {
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});

const userWith = (status: string) => ({
  id: 'u1',
  name: 'Ana Gómez',
  email: 'ana@correo.com',
  passwordHash,
  status,
});

const setup = () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    refreshToken: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const accessTokens = { sign: vi.fn().mockResolvedValue({ token: 'jwt', expiresIn: 900 }) };
  const service = new SessionService(
    prisma as unknown as PrismaService,
    accessTokens as unknown as AccessTokenService,
  );
  return { prisma, accessTokens, service };
};

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('debía fallar');
    },
    (error: unknown) => error,
  );

describe('SessionService.login', () => {
  it('HU-021 CA1: con credenciales correctas abre la sesión y guarda solo el hash del token', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(userWith('ACTIVE'));

    const result = await service.login(dto, meta);

    expect(result).toEqual({
      accessToken: 'jwt',
      expiresIn: 900,
      refreshToken: expect.any(String),
      user: { id: 'u1', name: 'Ana Gómez', email: 'ana@correo.com' },
    });
    const { data } = prisma.refreshToken.create.mock.calls[0][0];
    expect(data.tokenHash).toBe(hashToken(result.refreshToken));
    expect(data.tokenHash).not.toBe(result.refreshToken);
    expect(data).toMatchObject({ userId: 'u1', ip: '10.0.0.1', userAgent: 'vitest' });
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + REFRESH_TTL_MS - 60_000);
  });

  it('HU-021 CA2: una contraseña incorrecta responde el mensaje genérico', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(userWith('ACTIVE'));

    const error = await rejection(service.login({ ...dto, password: 'Otra12345' }, meta));

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).getResponse()).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Correo o contraseña incorrectos',
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('HU-021 CA2: un correo inexistente responde exactamente lo mismo', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(null);

    const error = await rejection(service.login(dto, meta));

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).getResponse()).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Correo o contraseña incorrectos',
    });
  });

  it('HU-021 CA4: una cuenta sin confirmar no entra y se indica confirmar el correo', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(userWith('PENDING_CONFIRMATION'));

    const error = await rejection(service.login(dto, meta));

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: 'EMAIL_NOT_CONFIRMED',
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('HU-021 CA4: sin la contraseña correcta no revela que la cuenta está pendiente', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(userWith('PENDING_CONFIRMATION'));

    const error = await rejection(service.login({ ...dto, password: 'Otra12345' }, meta));

    expect(error).toBeInstanceOf(UnauthorizedException);
  });

  it('una cuenta suspendida no entra', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(userWith('SUSPENDED'));

    const error = await rejection(service.login(dto, meta));

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: 'ACCOUNT_SUSPENDED',
    });
  });
});

describe('SessionService.refresh', () => {
  const stored = (overrides: Record<string, unknown> = {}) => ({
    id: 't1',
    userId: 'u1',
    familyId: 'f1',
    rotatedAt: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: { id: 'u1', status: 'ACTIVE' },
    ...overrides,
  });

  it('HU-021 CA5: rota el token, conserva la familia y entrega un acceso nuevo', async () => {
    const { prisma, service } = setup();
    prisma.refreshToken.findUnique.mockResolvedValue(stored());

    const result = await service.refresh('token-viejo', meta);

    expect(prisma.refreshToken.findUnique.mock.calls[0][0].where).toEqual({
      tokenHash: hashToken('token-viejo'),
    });
    expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toEqual({
      id: 't1',
      rotatedAt: null,
      revokedAt: null,
    });
    const { data } = prisma.refreshToken.create.mock.calls[0][0];
    expect(data).toMatchObject({ userId: 'u1', familyId: 'f1' });
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + REFRESH_TTL_MS - 60_000);
    expect(result).toEqual({
      accessToken: 'jwt',
      expiresIn: 900,
      refreshToken: expect.any(String),
    });
    expect(result.refreshToken).not.toBe('token-viejo');
  });

  it('sin cookie responde sesión expirada', async () => {
    const { prisma, service } = setup();

    const error = await rejection(service.refresh(undefined, meta));

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
  });

  it('un token desconocido responde sesión expirada', async () => {
    const { prisma, service } = setup();
    prisma.refreshToken.findUnique.mockResolvedValue(null);

    const error = await rejection(service.refresh('desconocido', meta));

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('HU-021 CA5: un token vencido por inactividad revoca la familia y pide iniciar sesión', async () => {
    const { prisma, service } = setup();
    prisma.refreshToken.findUnique.mockResolvedValue(
      stored({ expiresAt: new Date(Date.now() - 1000) }),
    );

    const error = await rejection(service.refresh('vencido', meta));

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toEqual({
      familyId: 'f1',
      revokedAt: null,
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('reusar un token ya rotado revoca toda la familia', async () => {
    const { prisma, service } = setup();
    prisma.refreshToken.findUnique.mockResolvedValue(stored({ rotatedAt: new Date() }));

    const error = await rejection(service.refresh('copiado', meta));

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toEqual({
      familyId: 'f1',
      revokedAt: null,
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('una cuenta suspendida no puede renovar la sesión', async () => {
    const { prisma, service } = setup();
    prisma.refreshToken.findUnique.mockResolvedValue(
      stored({ user: { id: 'u1', status: 'SUSPENDED' } }),
    );

    const error = await rejection(service.refresh('token', meta));

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('si otra renovación reclamó el token primero, revoca la familia', async () => {
    const { prisma, service } = setup();
    prisma.refreshToken.findUnique.mockResolvedValue(stored());
    prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

    const error = await rejection(service.refresh('token', meta));

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(2);
  });
});

describe('SessionService.logout', () => {
  it('HU-021 CA5: revoca la familia de sesiones del token', async () => {
    const { prisma, service } = setup();
    prisma.refreshToken.findUnique.mockResolvedValue({ familyId: 'f1' });

    await service.logout('token');

    expect(prisma.refreshToken.updateMany.mock.calls[0][0].where).toEqual({
      familyId: 'f1',
      revokedAt: null,
    });
  });

  it('sin cookie o con un token desconocido no es un error', async () => {
    const { prisma, service } = setup();
    prisma.refreshToken.findUnique.mockResolvedValue(null);

    await expect(service.logout(undefined)).resolves.toBeUndefined();
    await expect(service.logout('desconocido')).resolves.toBeUndefined();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

describe('SessionService.me', () => {
  it('devuelve los datos básicos de una cuenta activa', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue({ ...userWith('ACTIVE') });

    await expect(service.me('u1')).resolves.toEqual({
      id: 'u1',
      name: 'Ana Gómez',
      email: 'ana@correo.com',
    });
  });

  it('rechaza si la cuenta ya no existe o no está activa', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue({ ...userWith('SUSPENDED') });

    expect(await rejection(service.me('u1'))).toBeInstanceOf(UnauthorizedException);
  });
});