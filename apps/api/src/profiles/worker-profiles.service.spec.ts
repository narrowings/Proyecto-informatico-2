import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogsService } from '../catalogs/catalogs.service';
import type { IdentityService } from '../identity/identity.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CreateWorkerProfileDto } from './dto/create-worker-profile.dto';
import { WorkerProfilesService } from './worker-profiles.service';

const dto: CreateWorkerProfileDto = {
  displayName: 'Ana Gómez',
  skills: ['Pintura', 'Plomería'],
  experience: 'Cinco años en obras',
  zoneId: 2,
  categoryIds: [1, 3, 3],
};
const photo = { buffer: Buffer.from('imagen'), mimetype: 'image/png' };

const record = (overrides: object = {}) => ({
  id: 'w1',
  displayName: 'Ana Gómez',
  photoUrl: '/v1/profiles/worker/w1/photo',
  skills: ['Pintura', 'Plomería'],
  experience: 'Cinco años en obras',
  zoneId: 2,
  availability: 'AVAILABLE',
  createdAt: new Date('2026-11-21T10:00:00Z'),
  zone: { id: 2, name: 'Sur' },
  categories: [
    { id: 3, name: 'Reparaciones del hogar' },
    { id: 1, name: 'Trasteos y logística' },
  ],
  ...overrides,
});

const setup = ({
  active = true,
  existing = false,
  zoneOk = true,
  invalid = [] as number[],
} = {}) => {
  const prisma = {
    workerProfile: {
      findUnique: vi.fn().mockResolvedValue(existing ? { id: 'w0' } : null),
      create: vi.fn().mockImplementation(async () => record()),
    },
    workerPhoto: { findUnique: vi.fn() },
  };
  const identity = { isAccountActive: vi.fn().mockResolvedValue(active) };
  const catalogs = {
    isActiveZone: vi.fn().mockResolvedValue(zoneOk),
    findInvalidCategoryIds: vi.fn().mockResolvedValue(invalid),
  };
  const ratings = { getSummary: vi.fn().mockResolvedValue({ average: 4.5, isNew: false }) };
  const moduleRef = { get: vi.fn().mockReturnValue(ratings) };
  const service = new WorkerProfilesService(
    prisma as unknown as PrismaService,
    identity as unknown as IdentityService,
    catalogs as unknown as CatalogsService,
    moduleRef as unknown as ModuleRef,
  );
  return { prisma, identity, catalogs, ratings, moduleRef, service };
};

describe('WorkerProfilesService.create (HU-002)', () => {
  it('CA1: crea el perfil "Disponible" con la foto guardada y devuelve la vista del dueño', async () => {
    const { prisma, service } = setup();
    const profile = await service.create('u1', dto, photo);

    const { data } = prisma.workerProfile.create.mock.calls[0][0];
    expect(data).toMatchObject({
      userId: 'u1',
      displayName: 'Ana Gómez',
      skills: ['Pintura', 'Plomería'],
      experience: 'Cinco años en obras',
      zoneId: 2,
      categories: { connect: [{ id: 1 }, { id: 3 }] },
      photo: { create: { mediaType: 'image/png' } },
    });
    expect(data.photoUrl).toBe(`/v1/profiles/worker/${data.id}/photo`);
    expect(Buffer.from(data.photo.create.content).toString()).toBe('imagen');
    expect(data).not.toHaveProperty('availability');
    expect(profile).toEqual({
      id: 'w1',
      displayName: 'Ana Gómez',
      photoUrl: '/v1/profiles/worker/w1/photo',
      skills: ['Pintura', 'Plomería'],
      experience: 'Cinco años en obras',
      zoneId: 2,
      zone: { id: 2, name: 'Sur' },
      categoryIds: [3, 1],
      categories: record().categories,
      availability: 'AVAILABLE',
      createdAt: record().createdAt,
    });
  });

  it('guarda la experiencia vacía como null', async () => {
    const { prisma, service } = setup();
    await service.create('u1', { ...dto, experience: '' }, photo);
    expect(prisma.workerProfile.create.mock.calls[0][0].data.experience).toBeNull();
  });

  it('una cuenta sin confirmar no puede crear perfil (HU-001 CA1)', async () => {
    const { prisma, service } = setup({ active: false });
    await expect(service.create('u1', dto, photo)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workerProfile.create).not.toHaveBeenCalled();
  });

  it('un segundo perfil responde 409 WORKER_EXISTS', async () => {
    const { prisma, service } = setup({ existing: true });
    const error = await service.create('u1', dto, photo).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ code: 'WORKER_EXISTS' });
    expect(prisma.workerProfile.create).not.toHaveBeenCalled();
  });

  it('dos envíos simultáneos: el índice único deja pasar uno y el otro recibe 409', async () => {
    const { prisma, service } = setup();
    prisma.workerProfile.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(service.create('u1', dto, photo)).rejects.toBeInstanceOf(ConflictException);
  });

  it('zona y categorías inválidas se informan por campo y no se guarda nada', async () => {
    const { prisma, service } = setup({ zoneOk: false, invalid: [3] });
    const error = await service.create('u1', dto, photo).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual({
      message: 'Revisa los campos marcados',
      errors: {
        zoneId: ['Elige una zona de Cali de la lista'],
        categoryIds: ['Alguna categoría elegida ya no está disponible'],
      },
    });
    expect(prisma.workerProfile.create).not.toHaveBeenCalled();
  });
});

describe('WorkerProfilesService lecturas', () => {
  it('sin perfil, /me responde 404 para que el frontend lleve a crearlo (HU-022 CA3)', async () => {
    const { service } = setup();
    await expect(service.getOwn('u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('foto inexistente responde 404', async () => {
    const { prisma, service } = setup();
    prisma.workerPhoto.findUnique.mockResolvedValue(null);
    await expect(service.getPhoto('w9')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('WorkerProfilesService edición y perfil público (HU-032, HU-029, HU-030)', () => {
  const withStored = () => {
    const ctx = setup();
    ctx.prisma.workerProfile.findUnique.mockResolvedValue({ id: 'w1' });
    Object.assign(ctx.prisma.workerProfile, {
      update: vi
        .fn()
        .mockImplementation(async () => record({ showPhoto: true, showExperience: true })),
      findMany: vi.fn().mockResolvedValue([]),
    });
    return ctx;
  };

  it('HU-032 CA2: cambia la disponibilidad sin tocar lo demás ni validar catálogos ausentes', async () => {
    const { prisma, catalogs, service } = withStored();
    await service.update('u1', { availability: 'UNAVAILABLE' });
    const { data } = (prisma.workerProfile as unknown as { update: ReturnType<typeof vi.fn> })
      .update.mock.calls[0][0];
    expect(data).toMatchObject({
      availability: 'UNAVAILABLE',
      displayName: undefined,
      zoneId: undefined,
    });
    expect(data).not.toHaveProperty('categories');
    expect(catalogs.isActiveZone).not.toHaveBeenCalled();
    expect(catalogs.findInvalidCategoryIds).not.toHaveBeenCalled();
  });

  it('HU-032 CA1: reemplaza las categorías y borra la experiencia vacía', async () => {
    const { prisma, service } = withStored();
    await service.update('u1', { categoryIds: [3, 3, 1], experience: '' });
    const { data } = (prisma.workerProfile as unknown as { update: ReturnType<typeof vi.fn> })
      .update.mock.calls[0][0];
    expect(data.categories).toEqual({ set: [{ id: 3 }, { id: 1 }] });
    expect(data.experience).toBeNull();
  });

  it('una zona inválida en la edición se rechaza por campo', async () => {
    const { catalogs, service } = withStored();
    catalogs.isActiveZone.mockResolvedValue(false);
    await expect(service.update('u1', { zoneId: 99 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sin perfil, editar o cambiar la foto responde 404', async () => {
    const { service } = setup();
    await expect(service.update('u1', { availability: 'AVAILABLE' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.replacePhoto('u1', photo)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('la nueva foto cambia la URL para que no se muestre la anterior en caché', async () => {
    const { prisma, service } = withStored();
    await service.replacePhoto('u1', photo);
    const { data } = (prisma.workerProfile as unknown as { update: ReturnType<typeof vi.fn> })
      .update.mock.calls[0][0];
    expect(data.photoUrl).toMatch(/^\/v1\/profiles\/worker\/w1\/photo\?v=\d+$/);
    expect(data.photo.upsert.update.mediaType).toBe('image/png');
  });

  it('HU-030 CA4 y HU-029 CA4: el perfil público oculta foto y experiencia si así lo eligió, sin datos de contacto', async () => {
    const { prisma, ratings, service } = setup();
    prisma.workerProfile.findUnique.mockResolvedValue({
      ...record(),
      userId: 'u1',
      showPhoto: false,
      showExperience: false,
    });
    const result = await service.getPublic('w1');
    expect(result).toMatchObject({
      photoUrl: null,
      experience: null,
      reputation: { average: 4.5 },
    });
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('showPhoto');
    expect(ratings.getSummary).toHaveBeenCalledWith('u1', 'WORKER');
  });

  it('perfil público inexistente: 404', async () => {
    await expect(setup().service.getPublic('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
