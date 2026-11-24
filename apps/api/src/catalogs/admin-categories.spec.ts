import {
  ConflictException,
  Module,
  NotFoundException,
  type INestApplication,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminGuard } from '../audit/admin.guard';
import { AUDIT } from '../audit/audit.contract';
import type { AuthenticatedRequest } from '../common/auth/current-user.decorator';
import { validationPipe } from '../common/validation';
import { IdentityService } from '../identity/identity.service';
import type { PrismaService } from '../prisma/prisma.service';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminCategoriesService, CATEGORY_EXISTS } from './admin-categories.service';

const category = { id: 3, name: 'Plomería', description: null, isActive: true };
const actor = { userId: 'admin', ip: '10.0.0.1' };

const setup = () => {
  const prisma = {
    category: {
      findMany: vi.fn().mockResolvedValue([{ ...category, _count: { opportunities: 4 } }]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(category),
      create: vi.fn().mockImplementation(async ({ data }) => ({ id: 9, isActive: true, ...data })),
      update: vi.fn().mockImplementation(async ({ data }) => ({ ...category, ...data })),
    },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((operation: (tx: unknown) => unknown) =>
    operation(prisma),
  );
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new AdminCategoriesService(prisma as unknown as PrismaService, audit);
  return { prisma, audit, service };
};

describe('HU-037 Gestión de categorías', () => {
  it('lista todas, también las inactivas, con cuántas oportunidades las usan', async () => {
    const { prisma, service } = setup();
    await expect(service.list()).resolves.toEqual([{ ...category, opportunities: 4 }]);
    expect(prisma.category.findMany.mock.calls[0][0].where).toBeUndefined();
  });

  it('CA1: crea la categoría activa y lo audita en la misma transacción', async () => {
    const { prisma, audit, service } = setup();
    const created = await service.create({ name: 'Mascotas', description: 'Paseo' }, actor);
    expect(created).toMatchObject({ id: 9, name: 'Mascotas', isActive: true });
    expect(audit.record).toHaveBeenCalledWith(
      {
        actorUserId: 'admin',
        action: 'CATEGORY_CREATED',
        targetType: 'category',
        targetId: '9',
        ip: '10.0.0.1',
        data: { name: 'Mascotas' },
      },
      prisma,
    );
  });

  it('no admite un nombre repetido aunque cambien las mayúsculas', async () => {
    const { prisma, service, audit } = setup();
    prisma.category.findFirst.mockResolvedValue({ id: 3 });
    await expect(service.create({ name: 'PLOMERÍA' }, actor)).rejects.toMatchObject({
      response: CATEGORY_EXISTS,
    });
    expect(prisma.category.findFirst.mock.calls[0][0].where).toEqual({
      name: { equals: 'PLOMERÍA', mode: 'insensitive' },
    });
    expect(prisma.category.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('dos altas simultáneas con el mismo nombre: la segunda recibe 409', async () => {
    const { prisma, service } = setup();
    prisma.category.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(service.create({ name: 'Mascotas' }, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('CA2: desactivar solo cambia la bandera (las oportunidades conservan su categoría)', async () => {
    const { prisma, audit, service } = setup();
    await service.update(3, { isActive: false }, actor);
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { isActive: false },
      select: expect.any(Object),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CATEGORY_UPDATED',
        targetId: '3',
        data: { changed: 'isActive', name: 'Plomería', isActive: false },
      }),
      prisma,
    );
  });

  it('renombrar valida que el nombre esté libre fuera de la misma categoría y guarda el anterior', async () => {
    const { prisma, audit, service } = setup();
    await service.update(3, { name: 'Plomería y gas' }, actor);
    expect(prisma.category.findFirst.mock.calls[0][0].where).toEqual({
      name: { equals: 'Plomería y gas', mode: 'insensitive' },
      id: { not: 3 },
    });
    expect(audit.record.mock.calls[0][0].data).toEqual({
      changed: 'name',
      name: 'Plomería y gas',
      previousName: 'Plomería',
    });
  });

  it('una edición sin cambios reales no genera evento', async () => {
    const { audit, service } = setup();
    await service.update(3, { name: 'Plomería', isActive: true }, actor);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('editar una categoría inexistente responde 404', async () => {
    const { prisma, service } = setup();
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(service.update(99, { isActive: false }, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('si la auditoría falla, el cambio no se confirma', async () => {
    const { audit, service } = setup();
    audit.record.mockRejectedValue(new Error('db'));
    await expect(service.update(3, { isActive: false }, actor)).rejects.toThrow('db');
  });
});

describe('HU-037 Categorías por HTTP', () => {
  let app: INestApplication;
  let url: string;
  const service = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(category),
    update: vi.fn().mockResolvedValue(category),
  };
  const identity = { getAccess: vi.fn() };
  const audit = { record: vi.fn() };
  const admin = { 'x-test-user': 'admin', 'content-type': 'application/json' };

  beforeAll(async () => {
    @Module({
      controllers: [AdminCategoriesController],
      providers: [
        AdminGuard,
        { provide: AdminCategoriesService, useValue: service },
        { provide: IdentityService, useValue: identity },
        { provide: AUDIT, useValue: audit },
      ],
    })
    class TestModule {}

    app = await NestFactory.create(TestModule, { logger: false, abortOnError: false });
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const user = req.header('x-test-user');
      if (user) (req as AuthenticatedRequest).user = { id: user };
      next();
    });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(validationPipe);
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/v1/admin/categories`;
  });

  afterAll(() => app?.close());

  beforeEach(() => {
    vi.clearAllMocks();
    identity.getAccess.mockImplementation(async (id: string) => ({
      role: id === 'admin' ? 'ADMIN' : 'USER',
      status: 'ACTIVE',
    }));
  });

  it.each([
    ['GET', ''],
    ['POST', ''],
    ['PATCH', '/3'],
  ])('%s exige sesión (401) y rol administrador (403)', async (method, path) => {
    expect((await fetch(url + path, { method })).status).toBe(401);
    const denied = await fetch(url + path, {
      method,
      headers: { 'x-test-user': 'u1', 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : '{}',
    });
    expect(denied.status).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('crea con el nombre recortado y pasa quién lo hizo', async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers: admin,
      body: JSON.stringify({ name: '  Mascotas  ', description: '   ' }),
    });
    expect(response.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(
      { name: 'Mascotas', description: null },
      { userId: 'admin', ip: expect.any(String) },
    );
  });

  it.each([
    [{ name: 'ab' }],
    [{ name: 'Válida', description: 'x'.repeat(301) }],
    [{ name: 'Válida', extra: true }],
  ])('rechaza el cuerpo inválido %j', async (body) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: admin,
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('desactiva con PATCH y rechaza un id no numérico o un isActive que no es booleano', async () => {
    const ok = await fetch(`${url}/3`, {
      method: 'PATCH',
      headers: admin,
      body: JSON.stringify({ isActive: false }),
    });
    expect(ok.status).toBe(200);
    expect(service.update).toHaveBeenCalledWith(3, { isActive: false }, expect.any(Object));
    const badId = await fetch(`${url}/tres`, { method: 'PATCH', headers: admin, body: '{}' });
    expect(badId.status).toBe(400);
    const badFlag = await fetch(`${url}/3`, {
      method: 'PATCH',
      headers: admin,
      body: JSON.stringify({ isActive: 'no' }),
    });
    expect(badFlag.status).toBe(400);
  });
});
