import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '../common/auth/current-user.decorator';
import { validationPipe } from '../common/validation';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

describe('HU-007 Calificaciones por HTTP', () => {
  let app: INestApplication;
  let url: string;
  const servicio = { calificar: vi.fn().mockResolvedValue({ id: 'r' }) };

  beforeAll(async () => {
    @Module({
      controllers: [RatingsController],
      providers: [{ provide: RatingsService, useValue: servicio }],
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
    url = `${await app.getUrl()}/v1/jobs/6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f/ratings`;
  });

  afterAll(() => app?.close());

  it.each([0, 6, 3.5])('rechaza %s como puntuación de cumplimiento', async (fulfillment) => {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user': 'trabajador' },
      body: JSON.stringify({ fulfillment, punctuality: 3, communication: 4, quality: 5 }),
    });
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ errors: { fulfillment: expect.any(Array) } });
    expect(servicio.calificar).not.toHaveBeenCalled();
  });
});
