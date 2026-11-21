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
  const service = {
    accept: vi.fn().mockResolvedValue({ id }),
    listOwnJobs: vi.fn().mockResolvedValue({ items: [], total: 10, page: 2, pageSize: 10 }),
  };

  beforeAll(async () => {
    @Module({
      controllers: [EngagementsController],
      providers: [{ provide: EngagementsService, useValue: service }],
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
    url = `${await app.getUrl()}/v1`;
  });

  afterAll(() => app?.close());

  it('HU-006 exige aceptar expresamente los términos y devuelve el error por campo', async () => {
    const accept = (body: object) =>
      fetch(`${url}/selections/${id}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-test-user': 'trabajador' },
        body: JSON.stringify(body),
      });
    const invalid = await accept({});
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ errors: { acceptTerms: expect.any(Array) } });
    expect(service.accept).not.toHaveBeenCalled();
    expect((await accept({ acceptTerms: true })).status).toBe(200);
    expect(service.accept).toHaveBeenCalledWith(id, 'trabajador', true);
  });

  it('HU-028 exige sesión y aplica paginación al listado de trabajos', async () => {
    const route = `${url}/jobs?role=worker&state=active&page=2&pageSize=10`;
    expect((await fetch(route)).status).toBe(401);
    const response = await fetch(route, { headers: { 'x-test-user': 'trabajador' } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [], total: 10, page: 2, pageSize: 10 });
    expect(service.listOwnJobs).toHaveBeenCalledWith('trabajador', {
      role: 'worker',
      state: 'active',
      page: 2,
      pageSize: 10,
    });
  });
});
