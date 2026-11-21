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
  const service = { rate: vi.fn().mockResolvedValue({ id: 'r' }) };

  beforeAll(async () => {
    @Module({
      controllers: [RatingsController],
      providers: [{ provide: RatingsService, useValue: service }],
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
    url = `${await app.getUrl()}/v1/jobs/6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f/ratings`;
  });

  afterAll(() => app?.close());

  it.each([0, 6, 3.5])('rechaza %s como puntuación de cumplimiento', async (fulfillment) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user': 'trabajador' },
      body: JSON.stringify({ fulfillment, punctuality: 3, communication: 4, quality: 5 }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errors: { fulfillment: expect.any(Array) } });
    expect(service.rate).not.toHaveBeenCalled();
  });
});
