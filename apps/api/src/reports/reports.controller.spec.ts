import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '../common/auth/current-user.decorator';
import { rateLimitOptions } from '../common/http/rate-limit';
import { validationPipe } from '../common/validation';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

const ID = '11111111-1111-4111-8111-111111111111';

describe('HU-019 Reportes por HTTP', () => {
  let app: INestApplication;
  let url: string;
  const service = { create: vi.fn().mockResolvedValue({ id: 'r', message: 'Gracias' }) };
  const headers = { 'x-test-user': 'u1', 'content-type': 'application/json' };
  const post = (body: unknown, h: Record<string, string> = headers) =>
    fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body) });

  beforeAll(async () => {
    @Module({
      imports: [ThrottlerModule.forRoot(rateLimitOptions)],
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: service }],
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
    url = `${await app.getUrl()}/v1/reports`;
  });

  afterAll(() => app?.close());
  beforeEach(() => service.create.mockClear());

  it('exige sesión', async () => {
    const response = await post({}, { 'content-type': 'application/json' });
    expect(response.status).toBe(401);
  });

  it('CA1: crea el reporte de una publicación y responde el agradecimiento', async () => {
    const response = await post({ targetType: 'OPPORTUNITY', targetId: ID, reason: 'FRAUD' });
    expect(response.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith('u1', {
      targetType: 'OPPORTUNITY',
      targetId: ID,
      reason: 'FRAUD',
    });
  });

  it('CA3: el motivo OTHER exige una descripción de al menos 10 caracteres', async () => {
    for (const description of [undefined, '   corta   ']) {
      const response = await post({
        targetType: 'OPPORTUNITY',
        targetId: ID,
        reason: 'OTHER',
        description,
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ errors: { description: expect.any(Array) } });
    }
    expect(service.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ targetType: 'MENSAJE', targetId: ID, reason: 'SPAM' }],
    [{ targetType: 'USER', targetId: 'no-uuid', reason: 'SPAM', profileKind: 'WORKER' }],
    [{ targetType: 'USER', targetId: ID, reason: 'SPAM', profileKind: 'ADMIN' }],
    [{ targetType: 'OPPORTUNITY', targetId: ID, reason: 'ODIO' }],
    [{ targetType: 'OPPORTUNITY', targetId: ID, reason: 'SPAM', extra: 1 }],
  ])('rechaza el cuerpo inválido %j', async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('limita a 10 reportes por minuto por IP', async () => {
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      statuses.push(
        (await post({ targetType: 'OPPORTUNITY', targetId: ID, reason: 'SPAM' })).status,
      );
    }
    expect(statuses.at(-1)).toBe(429);
  });
});
