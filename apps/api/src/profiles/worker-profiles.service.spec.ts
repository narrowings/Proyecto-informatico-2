import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
  const service = new WorkerProfilesService(
    prisma as unknown as PrismaService,
    identity as unknown as IdentityService,
    catalogs as unknown as CatalogsService,
  );
  return { prisma, identity, catalogs, service };
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
