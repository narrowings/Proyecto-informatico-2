import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validationPipe } from '../common/validation';
import type { IdentityService } from '../identity/identity.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CreatePublisherProfileDto } from './dto/create-publisher-profile.dto';
import { ProfilesService } from './profiles.service';

const person = {
  kind: 'PERSON',
  displayName: 'Carlos Ruiz',
  photoUrl: 'https://cdn.example.com/carlos.jpg',
  description: 'Necesito ayuda con trasteos en el sur de Cali',
} as CreatePublisherProfileDto;

const company = {
  kind: 'COMPANY',
  displayName: 'Logística del Valle S.A.S.',
  photoUrl: 'https://cdn.example.com/logo.png',
  description: 'Empresa de transporte y bodegaje',
  nit: '890.903.938-8',
  contactName: 'María Pérez',
  sector: 'Transporte',
} as CreatePublisherProfileDto;

const stored = (overrides: object = {}) => ({
  id: 'p1',
  userId: 'u1',
  kind: 'COMPANY',
  displayName: company.displayName,
  photoUrl: company.photoUrl,
  description: company.description,
  nit: '890903938',
  nitCheckDigit: '8',
  contactName: 'María Pérez',
  sector: 'Transporte',
  isVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const setup = () => {
  const prisma = {
    publisherProfile: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(({ data }) => Promise.resolve(stored(data))),
      count: vi.fn(),
    },
  };
  const identity = { isAccountActive: vi.fn().mockResolvedValue(true) };
  const service = new ProfilesService(
    prisma as unknown as PrismaService,
    identity as unknown as IdentityService,
  );
  return { prisma, identity, service };
};

describe('ProfilesService.createPublisherProfile', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('HU-008 CA1: crea el perfil de persona natural sin datos de empresa', async () => {
    await ctx.service.createPublisherProfile('u1', { ...person, nit: '1', sector: 'x' });

    const { data } = ctx.prisma.publisherProfile.create.mock.calls[0][0];
    expect(data).toEqual({ userId: 'u1', ...person });
  });

  it('HU-008 CA2: crea el perfil de empresa con el NIT separado de su dígito de verificación', async () => {
    const result = await ctx.service.createPublisherProfile('u1', company);

    const { data } = ctx.prisma.publisherProfile.create.mock.calls[0][0];
    expect(data).toMatchObject({ nit: '890903938', nitCheckDigit: '8', sector: 'Transporte' });
    expect(result.nit).toBe('890903938-8');
  });

  it('RF-01-05: exige la cuenta confirmada', async () => {
    ctx.identity.isAccountActive.mockResolvedValue(false);

    await expect(ctx.service.createPublisherProfile('u1', person)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rechaza un segundo perfil de publicador', async () => {
    ctx.prisma.publisherProfile.findUnique.mockResolvedValue({ id: 'p0' });

    await expect(ctx.service.createPublisherProfile('u1', person)).rejects.toThrow(
      'Ya tienes un perfil de publicador',
    );
  });

  it('rechaza un NIT ya registrado por otra empresa', async () => {
    ctx.prisma.publisherProfile.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'x',
        meta: { target: ['nit'] },
      }),
    );

    await expect(ctx.service.createPublisherProfile('u1', company)).rejects.toThrow(
      new ConflictException('Ya existe una empresa registrada con este NIT'),
    );
  });
});

describe('ProfilesService.getPublicPublisherProfile', () => {
  it('HU-008 CA3: no expone NIT, contacto ni el usuario dueño', async () => {
    const { prisma, service } = setup();
    prisma.publisherProfile.findUnique.mockResolvedValue(stored());

    const result = await service.getPublicPublisherProfile('p1');

    expect(result).not.toHaveProperty('nit');
    expect(result).not.toHaveProperty('contactName');
    expect(result).not.toHaveProperty('userId');
    expect(result).toMatchObject({ displayName: company.displayName, isVerified: false });
    expect(result.reputation).toEqual({ average: null, ratingsCount: 0, completedJobs: 0 });
  });

  it('responde 404 si el perfil no existe', async () => {
    const { service } = setup();
    await expect(service.getPublicPublisherProfile('nada')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('CreatePublisherProfileDto', () => {
  const transform = (body: object) =>
    validationPipe.transform(body, { type: 'body', metatype: CreatePublisherProfileDto });

  const fieldErrors = (body: object) =>
    transform(body).then(
      () => {
        throw new Error('se esperaba un error de validación');
      },
      (error: BadRequestException) =>
        (error.getResponse() as { errors: Record<string, string[]> }).errors,
    );

  it('acepta una persona natural sin campos de empresa', async () => {
    await expect(transform(person)).resolves.toMatchObject(person);
  });

  it('HU-008 CA2: exige NIT válido, contacto y sector a una empresa', async () => {
    const errors = await fieldErrors({
      ...company,
      nit: '890903938-7',
      contactName: '',
      sector: undefined,
    });
    expect(errors).toEqual({
      nit: ['El NIT no es válido; revisa el dígito de verificación'],
      contactName: ['El nombre del contacto o representante es obligatorio'],
      sector: ['El sector es obligatorio'],
    });
  });
});
