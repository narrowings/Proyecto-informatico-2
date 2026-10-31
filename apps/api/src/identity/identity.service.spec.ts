import { BadRequestException, ConflictException, GoneException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { ConfirmationMailer } from './confirmation-mailer';
import type { RegisterDto } from './dto/register.dto';
import { EMAIL_TAKEN_MESSAGE, IdentityService } from './identity.service';
import { hashToken } from './tokens';

const dto: RegisterDto = {
  name: 'Ana Gómez',
  email: 'ana@correo.com',
  phone: '+573001234567',
  password: 'Segura123',
  acceptTerms: true,
  acceptPrivacyPolicy: true,
  authorizeDataTreatment: true,
  confirmAdult: true,
};

const legalDocuments = [
  { id: 'doc-terms', type: 'TERMS', version: '0.1', url: '/legal/terminos' },
  { id: 'doc-privacy', type: 'PRIVACY_POLICY', version: '0.1', url: '/legal/privacidad' },
  { id: 'doc-data', type: 'DATA_TREATMENT', version: '0.1', url: '/legal/tratamiento-de-datos' },
];

const setup = () => {
  const prisma = {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    legalDocument: { findMany: vi.fn().mockResolvedValue(legalDocuments) },
    emailConfirmationToken: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((operations: unknown[]) => Promise.all(operations)),
  };
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  const config = { get: vi.fn((_key: string, fallback: string) => fallback) };
  const service = new IdentityService(
    prisma as unknown as PrismaService,
    mailer as unknown as ConfirmationMailer,
    config as unknown as ConfigService,
  );
  return { prisma, mailer, service };
};

describe('IdentityService.register', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
    ctx.prisma.user.findUnique.mockResolvedValue(null);
    ctx.prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'u1',
        name: data.name,
        email: data.email,
        status: 'PENDING_CONFIRMATION',
      }),
    );
  });

  it('HU-001 CA1: crea la cuenta pendiente con contraseña Argon2id y envía el enlace', async () => {
    const result = await ctx.service.register(dto, '10.0.0.1');

    expect(result).toEqual({ id: 'u1', email: dto.email, status: 'PENDING_CONFIRMATION' });
    const { data } = ctx.prisma.user.create.mock.calls[0][0];
    expect(data.phone).toBe('3001234567');
    expect(data.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(data.passwordHash, dto.password)).toBe(true);

    const link: string = ctx.mailer.send.mock.calls[0][0].link;
    const token = new URL(link).searchParams.get('token') as string;
    expect(link).toMatch(/^http:\/\/localhost:3000\/confirmar-correo\?token=/);
    expect(data.confirmationTokens.create.tokenHash).toBe(hashToken(token));
    const ttl = data.confirmationTokens.create.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(23.9 * 3600_000);
    expect(ttl).toBeLessThanOrEqual(24 * 3600_000);
  });

  it('HU-017 CA2: guarda un consentimiento por documento vigente con IP', async () => {
    await ctx.service.register(dto, '10.0.0.1');

    const { data } = ctx.prisma.user.create.mock.calls[0][0];
    expect(data.consents.create).toEqual(
      legalDocuments.map((doc) => ({
        legalDocumentId: doc.id,
        acceptedAt: expect.any(Date),
        ip: '10.0.0.1',
      })),
    );
    expect(data.ageConfirmedAt).toBeInstanceOf(Date);
  });

  it('HU-001 CA3: rechaza un correo ya registrado', async () => {
    ctx.prisma.user.findUnique.mockResolvedValue({ id: 'otro' });

    await expect(ctx.service.register(dto, '10.0.0.1')).rejects.toThrow(
      new ConflictException(EMAIL_TAKEN_MESSAGE),
    );
    expect(ctx.prisma.user.create).not.toHaveBeenCalled();
  });

  it('HU-001 CA3: también con dos registros simultáneos (violación de unicidad)', async () => {
    ctx.prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' }),
    );

    await expect(ctx.service.register(dto, '10.0.0.1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('crea la cuenta aunque falle el envío del correo', async () => {
    ctx.mailer.send.mockRejectedValue(new Error('SMTP caído'));
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(ctx.service.register(dto, '10.0.0.1')).resolves.toMatchObject({ id: 'u1' });
  });
});

describe('IdentityService.confirmEmail', () => {
  const record = (overrides: object = {}) => ({
    id: 't1',
    usedAt: null,
    expiresAt: new Date(Date.now() + 3600_000),
    user: { id: 'u1', status: 'PENDING_CONFIRMATION' },
    ...overrides,
  });

  it('HU-001 CA2: activa la cuenta y marca el token como usado', async () => {
    const { prisma, service } = setup();
    prisma.emailConfirmationToken.findUnique.mockResolvedValue(record());

    await expect(service.confirmEmail('abc')).resolves.toEqual({ status: 'ACTIVE' });
    expect(prisma.emailConfirmationToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashToken('abc') } }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { status: 'ACTIVE', emailConfirmedAt: expect.any(Date) },
    });
    expect(prisma.emailConfirmationToken.update).toHaveBeenCalled();
  });

  it('HU-001 CA2: un enlace vencido responde 410 para ofrecer uno nuevo', async () => {
    const { prisma, service } = setup();
    prisma.emailConfirmationToken.findUnique.mockResolvedValue(
      record({ expiresAt: new Date(Date.now() - 1) }),
    );

    await expect(service.confirmEmail('abc')).rejects.toBeInstanceOf(GoneException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rechaza un token inexistente o ya usado', async () => {
    const { prisma, service } = setup();
    prisma.emailConfirmationToken.findUnique.mockResolvedValueOnce(null);
    await expect(service.confirmEmail('x')).rejects.toBeInstanceOf(BadRequestException);

    prisma.emailConfirmationToken.findUnique.mockResolvedValueOnce(record({ usedAt: new Date() }));
    await expect(service.confirmEmail('x')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('abrir el enlace de una cuenta ya activa no es un error', async () => {
    const { prisma, service } = setup();
    prisma.emailConfirmationToken.findUnique.mockResolvedValue(
      record({ usedAt: new Date(), user: { id: 'u1', status: 'ACTIVE' } }),
    );

    await expect(service.confirmEmail('abc')).resolves.toEqual({ status: 'ACTIVE' });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('IdentityService.resendConfirmation', () => {
  it('invalida los enlaces anteriores y envía uno nuevo a una cuenta pendiente', async () => {
    const { prisma, mailer, service } = setup();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      name: 'Ana',
      email: 'ana@correo.com',
      status: 'PENDING_CONFIRMATION',
    });

    await service.resendConfirmation('ana@correo.com');

    expect(prisma.emailConfirmationToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(prisma.emailConfirmationToken.create).toHaveBeenCalled();
    expect(mailer.send).toHaveBeenCalledOnce();
  });

  it.each([null, { id: 'u1', status: 'ACTIVE' }])(
    'no hace nada si la cuenta no existe o ya está activa (%o)',
    async (user) => {
      const { prisma, mailer, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user);

      await service.resendConfirmation('ana@correo.com');

      expect(prisma.emailConfirmationToken.create).not.toHaveBeenCalled();
      expect(mailer.send).not.toHaveBeenCalled();
    },
  );
});

describe('IdentityService.currentLegalDocuments', () => {
  it('falla si falta algún documento legal vigente', async () => {
    const { prisma, service } = setup();
    prisma.legalDocument.findMany.mockResolvedValue(legalDocuments.slice(0, 2));

    await expect(service.currentLegalDocuments()).rejects.toThrow(/seed/);
  });
});
