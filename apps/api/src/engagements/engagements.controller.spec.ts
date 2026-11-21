import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '../common/auth/current-user.decorator';
import { validationPipe } from '../common/validation';
import { EngagementsController } from './engagements.controller';
import { EngagementsService } from './engagements.service';

describe('HU-006 y HU-028 Selecciones y trabajos por HTTP', () => {
  let app: INestApplication;
  let url: string;
  const id = '6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f';
  const servicio = {
    aceptar: vi.fn().mockResolvedValue({ id }),
    trabajosPropios: vi.fn().mockResolvedValue({ items: [] }),
  };

  beforeAll(async () => {
    @Module({
      controllers: [EngagementsController],
      providers: [{ provide: EngagementsService, useValue: servicio }],
    })
    class ModuloPrueba {}
    app = await NestFactory.create(ModuloPrueba, { logger: false, abortOnError: false });
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const usuario = req.header('x-test-user');
      if (usuario) (req as AuthenticatedRequest).user = { id: usuario };
      next();
    });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(validationPipe);
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/v1`;
  });

  afterAll(() => app?.close());

  it('HU-006 exige aceptar expresamente los términos y devuelve el error por campo', async () => {
    const aceptar = (body: object) =>
      fetch(`${url}/selections/${id}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-test-user': 'trabajador' },
        body: JSON.stringify(body),
      });
    const invalida = await aceptar({});
    expect(invalida.status).toBe(400);
    expect(await invalida.json()).toMatchObject({ errors: { acceptTerms: expect.any(Array) } });
    expect(servicio.aceptar).not.toHaveBeenCalled();
    expect((await aceptar({ acceptTerms: true })).status).toBe(200);
    expect(servicio.aceptar).toHaveBeenCalledWith(id, 'trabajador', true);
  });

  it('HU-028 exige sesión y aplica paginación al listado de trabajos', async () => {
    const ruta = `${url}/jobs?role=worker&state=active&page=2&pageSize=10`;
    expect((await fetch(ruta)).status).toBe(401);
    const respuesta = await fetch(ruta, { headers: { 'x-test-user': 'trabajador' } });
    expect(respuesta.status).toBe(200);
    expect(servicio.trabajosPropios).toHaveBeenCalledWith('trabajador', {
      role: 'worker',
      state: 'active',
      page: 2,
      pageSize: 10,
    });
  });
});
