import { type INestApplication, Module, NotFoundException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogsController } from '../catalogs/catalogs.controller';
import { CatalogsService } from '../catalogs/catalogs.service';
import { validationPipe } from '../common/validation';
import { WorkerProfilesController } from './worker-profiles.controller';
import { WorkerProfilesService } from './worker-profiles.service';

// HTTP real con multipart/form-data. El servicio va simulado; su lógica está en worker-profiles.service.spec.ts.
// En la app real AccessTokenMiddleware llena request.user desde el JWT; aquí lo simula la cabecera x-test-user.
// Vitest no emite la metadata de tipos, así que aquí @Body() no conoce el DTO: la conversión y validación
// de campos se prueba en create-worker-profile.dto.spec.ts con el mismo validationPipe.

// PNG real de 1×1: el validador revisa la firma del archivo, no solo el tipo que declara el navegador.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

describe('WorkerProfilesController y CatalogsController (HTTP)', () => {
  let app: INestApplication;
  let url: string;
  const workers = {
    create: vi.fn().mockResolvedValue({ id: 'w1' }),
    getOwn: vi.fn().mockResolvedValue({ id: 'w1' }),
    getPhoto: vi.fn(),
    getOwnPhoto: vi.fn(),
  };
  const catalogs = {
    listZones: vi.fn().mockResolvedValue([{ id: 2, name: 'Sur' }]),
    listCategories: vi.fn().mockResolvedValue([{ id: 1, name: 'Eventos', description: null }]),
  };

  beforeEach(async () => {
    @Module({
      controllers: [WorkerProfilesController, CatalogsController],
      providers: [
        { provide: WorkerProfilesService, useValue: workers },
        { provide: CatalogsService, useValue: catalogs },
      ],
    })
    class TestModule {}

    const nest = await NestFactory.create<NestExpressApplication>(TestModule, { logger: false });
    nest.use((req: Request & { user?: { id: string } }, _res: Response, next: NextFunction) => {
      const id = req.headers['x-test-user'];
      if (typeof id === 'string') req.user = { id };
      next();
    });
    nest.setGlobalPrefix('v1');
    nest.useGlobalPipes(validationPipe);
    await nest.listen(0, '127.0.0.1');
    app = nest;
    url = `${await nest.getUrl()}/v1`;
    vi.clearAllMocks();
  });

  afterEach(() => app.close());

  const form = (photo: Blob | null = new Blob([PNG], { type: 'image/png' })) => {
    const body = new FormData();
    if (photo) body.set('photo', photo, 'ana.png');
    body.set('displayName', 'Ana Gómez');
    body.set('skills', JSON.stringify(['Pintura']));
    body.set('experience', '');
    body.set('zoneId', '2');
    body.set('categoryIds', JSON.stringify([1]));
    return body;
  };

  const createProfile = (body: FormData, user: string | null = 'u1') =>
    fetch(`${url}/profiles/worker`, {
      method: 'POST',
      headers: user ? { 'x-test-user': user } : {},
      body,
    });

  it('crea el perfil con la foto y los campos convertidos (HU-002 CA1)', async () => {
    const response = await createProfile(form());
    expect(response.status).toBe(201);
    const [userId, dto, photo] = workers.create.mock.calls[0];
    expect(userId).toBe('u1');
    expect(dto).toMatchObject({ displayName: 'Ana Gómez', zoneId: '2', categoryIds: '[1]' });
    expect(photo.mimetype).toBe('image/png');
  });

  it('sin sesión responde 401 y no crea nada', async () => {
    expect((await createProfile(form(), null)).status).toBe(401);
    expect(workers.create).not.toHaveBeenCalled();
  });

  it('sin foto responde 400', async () => {
    expect((await createProfile(form(null))).status).toBe(400);
    expect(workers.create).not.toHaveBeenCalled();
  });

  it('un archivo que no es imagen, aunque diga image/png, responde 400 en el campo photo', async () => {
    const response = await createProfile(form(new Blob(['<script>'], { type: 'image/png' })));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errors: { photo: ['Selecciona una imagen JPG, PNG o WebP válida.'] },
    });
  });

  it('una foto de más de 5 MiB se rechaza (RNF-REN-07)', async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 2);
    big.set(PNG);
    const response = await createProfile(form(new Blob([big], { type: 'image/png' })));
    expect(response.status).toBe(413);
    expect(workers.create).not.toHaveBeenCalled();
  });

  it('/me exige sesión y devuelve el perfil propio', async () => {
    expect((await fetch(`${url}/profiles/worker/me`)).status).toBe(401);
    const response = await fetch(`${url}/profiles/worker/me`, { headers: { 'x-test-user': 'u1' } });
    expect(response.status).toBe(200);
    expect(workers.getOwn).toHaveBeenCalledWith('u1');
  });

  it('la foto es pública, con su tipo y nosniff', async () => {
    workers.getPhoto.mockResolvedValue({ content: PNG, mediaType: 'image/png' });
    const id = '6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f';
    const response = await fetch(`${url}/profiles/worker/${id}/photo`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    // Sin sesión no hay usuario: el servicio decide si la foto está oculta (HU-030 CA4).
    expect(workers.getPhoto).toHaveBeenCalledWith(id, undefined);
  });

  it('con sesión, la foto pública se pide con el usuario para que el dueño vea la suya oculta', async () => {
    workers.getPhoto.mockResolvedValue({ content: PNG, mediaType: 'image/png' });
    const id = '6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f';
    await fetch(`${url}/profiles/worker/${id}/photo`, { headers: { 'x-test-user': 'u1' } });
    expect(workers.getPhoto).toHaveBeenCalledWith(id, 'u1');
  });

  it('una foto oculta responde 404 por su URL pública', async () => {
    workers.getPhoto.mockRejectedValue(new NotFoundException('Foto no encontrada'));
    const id = '6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f';
    expect((await fetch(`${url}/profiles/worker/${id}/photo`)).status).toBe(404);
  });

  it('"me/photo" exige sesión, devuelve la foto propia y no se guarda en caché', async () => {
    workers.getOwnPhoto.mockResolvedValue({ content: PNG, mediaType: 'image/png' });
    expect((await fetch(`${url}/profiles/worker/me/photo`)).status).toBe(401);
    const response = await fetch(`${url}/profiles/worker/me/photo`, {
      headers: { 'x-test-user': 'u1' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(workers.getOwnPhoto).toHaveBeenCalledWith('u1');
  });

  it('un id de foto que no es UUID responde 400 sin consultar la base', async () => {
    expect((await fetch(`${url}/profiles/worker/abc/photo`)).status).toBe(400);
    expect(workers.getPhoto).not.toHaveBeenCalled();
  });

  it('zonas y categorías son públicas y cacheables (T-03)', async () => {
    const zones = await fetch(`${url}/zones`);
    expect(zones.status).toBe(200);
    expect(await zones.json()).toEqual([{ id: 2, name: 'Sur' }]);
    expect(zones.headers.get('cache-control')).toBe('public, max-age=300');

    const categories = await fetch(`${url}/categories`);
    expect(await categories.json()).toEqual([{ id: 1, name: 'Eventos', description: null }]);
  });
});
