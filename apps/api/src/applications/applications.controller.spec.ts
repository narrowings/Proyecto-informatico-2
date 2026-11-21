import { type INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validationPipe } from '../common/validation';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

// HTTP real con el servicio simulado. validateDto valida cuerpos y consultas aunque Vitest no emita
// metadata de tipos. El usuario de la sesión lo simula la cabecera x-test-user.
const OPP = '6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f';
const OPP2 = '7a2d2a6f-4b2c-4c6f-8e1f-2d3c4b5e6f70';

describe('ApplicationsController (HTTP)', () => {
  let app: INestApplication;
  let url: string;
  const service = {
    apply: vi.fn().mockResolvedValue({ id: 'a1', status: 'RECEIVED' }),
    listCandidates: vi.fn().mockResolvedValue([]),
    listMine: vi.fn().mockResolvedValue({ items: [] }),
    statusFor: vi.fn().mockResolvedValue({}),
    changeStatus: vi.fn().mockResolvedValue({ id: 'a1', status: 'INTERVIEW' }),
  };

  beforeEach(async () => {
    @Module({
      controllers: [ApplicationsController],
      providers: [{ provide: ApplicationsService, useValue: service }],
    })
    class TestModule {}
    const nest = await NestFactory.create<NestExpressApplication>(TestModule, { logger: false });
    nest.use((req: Request & { user?: { id: string } }, _res: Response, next: NextFunction) => {
      const user = req.headers['x-test-user'];
      if (typeof user === 'string') req.user = { id: user };
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

  const send = (method: string, path: string, body?: object, user: string | null = 'w1') =>
    fetch(`${url}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });

  it.each([
    ['POST', `/opportunities/${OPP}/applications`],
    ['GET', `/opportunities/${OPP}/candidates`],
    ['GET', '/applications/mine'],
    ['GET', `/applications/status?opportunityIds=${OPP}`],
    ['PATCH', `/applications/${OPP}/status`],
  ])('%s %s exige sesión', async (method, path) => {
    expect((await send(method, path, method === 'GET' ? undefined : {}, null)).status).toBe(401);
  });

  it('HU-005: postularse con el usuario de la sesión y mensaje recortado', async () => {
    const response = await send('POST', `/opportunities/${OPP}/applications`, {
      message: '  Tengo experiencia  ',
    });
    expect(response.status).toBe(201);
    expect(service.apply).toHaveBeenCalledWith('w1', OPP, { message: 'Tengo experiencia' });
  });

  it('rechaza un mensaje de más de 1000 caracteres y campos ajenos', async () => {
    const long = await send('POST', `/opportunities/${OPP}/applications`, {
      message: 'a'.repeat(1001),
    });
    expect(long.status).toBe(400);
    const extra = await send('POST', `/opportunities/${OPP}/applications`, { status: 'ACCEPTED' });
    expect(extra.status).toBe(400);
    expect(service.apply).not.toHaveBeenCalled();
  });

  it('un id que no es UUID responde 400', async () => {
    expect((await send('POST', '/opportunities/abc/applications', {})).status).toBe(400);
  });

  it('"Postulaciones activas" por defecto y paginación validada', async () => {
    await send('GET', '/applications/mine');
    expect(service.listMine).toHaveBeenCalledWith(
      'w1',
      expect.objectContaining({ state: 'active', page: 1 }),
    );
    expect((await send('GET', '/applications/mine?pageSize=51')).status).toBe(400);
    expect((await send('GET', '/applications/mine?state=otra')).status).toBe(400);
  });

  it('estado por tarjeta: lista de UUID separada por comas, máximo 50', async () => {
    await send('GET', `/applications/status?opportunityIds=${OPP},${OPP2}`);
    expect(service.statusFor).toHaveBeenCalledWith('w1', [OPP, OPP2]);
    expect((await send('GET', '/applications/status?opportunityIds=abc')).status).toBe(400);
    const many = Array.from({ length: 51 }, () => OPP).join(',');
    expect((await send('GET', `/applications/status?opportunityIds=${many}`)).status).toBe(400);
  });

  it('HU-024 CA2: solo acepta los estados del publicador', async () => {
    expect(
      (await send('PATCH', `/applications/${OPP}/status`, { status: 'INTERVIEW' }, 'pub')).status,
    ).toBe(200);
    expect(service.changeStatus).toHaveBeenCalledWith('pub', OPP, { status: 'INTERVIEW' });
    for (const status of ['RECEIVED', 'WITHDRAWN', 'cualquiera']) {
      expect((await send('PATCH', `/applications/${OPP}/status`, { status }, 'pub')).status).toBe(
        400,
      );
    }
  });
});
