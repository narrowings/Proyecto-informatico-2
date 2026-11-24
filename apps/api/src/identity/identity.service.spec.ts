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
  consents: { terms: '0.1', privacy: '0.1', dataProcessing: '0.1', isAdult: true },
};

const legalDocuments = [
  { id: 'doc-terms', type: 'TERMS', version: '0.1', url: '/legal/terminos' },
  { id: 'doc-privacy', type: 'PRIVACY_POLICY', version: '0.1', url: '/legal/privacidad' },
  { id: 'doc-data', type: 'DATA_TREATMENT', version: '0.1', url: '/legal/autorizacion-datos' },
];

const setup = () => {
  const prisma = {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    consent: { count: vi.fn(), createMany: vi.fn().mockResolvedValue({ count: 3 }) },
    legalDocument: { findMany: vi.fn().mockResolvedValue(legalDocuments) },
    emailConfirmationToken: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  // Como Prisma: una lista de operaciones o una función que recibe el cliente de la transacción.
  prisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? arg(prisma) : Promise.all(arg as unknown[]),
  );
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  const config = { get: vi.fn((_key: string, fallback: string) => fallback) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new IdentityService(
    prisma as unknown as PrismaService,
    mailer as unknown as ConfirmationMailer,
    config as unknown as ConfigService,
    audit,
  );
  return { prisma, mailer, audit, service };
};

it('solicita las versiones pendientes al ingresar y conserva el primer consentimiento en los reintentos', async () => {
  const { prisma, service } = setup();
  prisma.consent.count.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
  expect(await service.requiresTermsAcceptance('u1')).toBe(true);
  await expect(
    service.acceptTerms('u1', { ...dto.consents, terms: 'anterior' }, '10.0.0.1'),
  ).rejects.toBeInstanceOf(ConflictException);
  expect(prisma.consent.createMany).not.toHaveBeenCalled();
  await service.acceptTerms('u1', dto.consents, '10.0.0.1');
  expect(prisma.consent.createMany).toHaveBeenCalledWith({
    data: legalDocuments.map((doc) => ({ userId: 'u1', legalDocumentId: doc.id, ip: '10.0.0.1' })),
    skipDuplicates: true,
  });
  expect(await service.requiresTermsAcceptance('u1')).toBe(false);
});

describe('HU-038 CA1: aceptación de términos en la auditoría', () => {
  it('al aceptar versiones nuevas registra el evento con las versiones y la IP', async () => {
    const { audit, prisma, service } = setup();
    await service.acceptTerms('u1', dto.consents, '10.0.0.1');
    expect(audit.record).toHaveBeenCalledWith(
      {
        actorUserId: 'u1',
        action: 'TERMS_ACCEPTED',
        targetType: 'user',
        targetId: 'u1',
        ip: '10.0.0.1',
        data: { TERMS: '0.1', PRIVACY_POLICY: '0.1', DATA_TREATMENT: '0.1' },
      },
      prisma,
    );
  });

  it('repetir la aceptación de lo ya aceptado no crea otro evento', async () => {
    const { audit, prisma, service } = setup();
    prisma.consent.createMany.mockResolvedValue({ count: 0 });
    await service.acceptTerms('u1', dto.consents, '10.0.0.1');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('si la auditoría falla, la aceptación no se confirma', async () => {
    const { audit, service } = setup();
    audit.record.mockRejectedValue(new Error('db'));
    await expect(service.acceptTerms('u1', dto.consents, '10.0.0.1')).rejects.toThrow('db');
  });
});

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
    // HU-038 CA1: en la misma transacción que crea la cuenta.
    expect(ctx.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TERMS_ACCEPTED', ip: '10.0.0.1', targetType: 'user' }),
      ctx.prisma,
    );
  });

  it('HU-017 CA2: responde 409 si el usuario aceptó una versión que ya no está vigente', async () => {
    const outdated = { ...dto, consents: { ...dto.consents, privacy: '0.0' } };

    const error = await ctx.service.register(outdated, '10.0.0.1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      code: 'VERSION_LEGAL_DESACTUALIZADA',
      current: legalDocuments.map(({ type, version, url }) => ({ type, version, url })),
    });
    expect(ctx.prisma.user.create).not.toHaveBeenCalled();
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

  it('si falla el SMTP el log solo lleva el código, nunca el enlace ni el correo', async () => {
    ctx.mailer.send.mockImplementation(async ({ link }: { link: string }) => {
      throw Object.assign(new Error(`550 rechazado <ana@correo.com> ${link}`), {
        code: 'EENVELOPE',
        response: `550 <ana@correo.com> ${link}`,
      });
    });
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await ctx.service.register(dto, '10.0.0.1');

    const link: string = ctx.mailer.send.mock.calls[0][0].link;
    const token = new URL(link).searchParams.get('token') as string;
    const written = JSON.stringify(error.mock.calls);
    expect(error).toHaveBeenCalledOnce();
    expect(written).toContain('EENVELOPE');
    expect(written).not.toContain(token);
    expect(written).not.toContain('ana@correo.com');
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

describe('HU-014 Destinatarios de las notificaciones', () => {
  it('consulta únicamente el nombre y correo de una cuenta activa', async () => {
    const { prisma, service } = setup();
    const recipient = { name: 'Ana', email: 'ana@example.com' };
    prisma.user.findUnique.mockResolvedValue(recipient);

    await expect(service.getNotificationRecipient('u1')).resolves.toEqual(recipient);
    expect(prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({
      where: { id: 'u1', status: 'ACTIVE' },
      select: { name: true, email: true },
    });
  });

  it('devuelve nulo si no hay una cuenta activa para ese usuario', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getNotificationRecipient('u1')).resolves.toBeNull();
  });
});

describe('Acceso y estado de cuenta para administración (HU-012)', () => {
  const adminSetup = () => {
    const ctx = setup();
    const user = ctx.prisma.user as Record<string, ReturnType<typeof vi.fn>>;
    user.count = vi.fn().mockResolvedValue(1);
    user.findMany = vi.fn().mockResolvedValue([{ id: 'u1' }]);
    user.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    return { ...ctx, user };
  };

  it('getAccess lee solo rol y estado', async () => {
    const { user, service } = adminSetup();
    user.findUnique.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    await expect(service.getAccess('u1')).resolves.toEqual({ role: 'ADMIN', status: 'ACTIVE' });
    expect(user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { role: true, status: true },
    });
  });

  it('CA3: busca por nombre sin distinguir mayúsculas o por correo, filtra por estado y pagina', async () => {
    const { user, service } = adminSetup();
    const result = await service.searchUsers({
      q: '  ANA@ ',
      status: 'ACTIVE',
      page: 2,
      pageSize: 5,
    });
    const where = {
      status: 'ACTIVE',
      OR: [{ name: { contains: 'ANA@', mode: 'insensitive' } }, { email: { contains: 'ana@' } }],
    };
    expect(user.count).toHaveBeenCalledWith({ where });
    expect(user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 5, take: 5 }),
    );
    const { select } = user.findMany.mock.calls[0][0];
    expect(select).not.toHaveProperty('passwordHash');
    expect(result).toMatchObject({ total: 1, page: 2, pageSize: 5 });
  });

  it('una búsqueda vacía no filtra por texto', async () => {
    const { user, service } = adminSetup();
    await service.searchUsers({ q: '   ', page: 1, pageSize: 20 });
    expect(user.count).toHaveBeenCalledWith({ where: {} });
  });

  it('cambia el estado solo desde los estados permitidos', async () => {
    const { user, service } = adminSetup();
    await expect(service.setAccountStatus('u1', ['ACTIVE'], 'BLOCKED')).resolves.toBe(true);
    expect(user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', status: { in: ['ACTIVE'] } },
      data: { status: 'BLOCKED' },
    });
    user.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.setAccountStatus('u1', ['ACTIVE'], 'BLOCKED')).resolves.toBe(false);
  });
});
