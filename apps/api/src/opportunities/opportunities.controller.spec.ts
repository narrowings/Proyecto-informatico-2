import { type INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rateLimitOptions } from '../common/http/rate-limit';
import { applyTrustProxy } from '../common/http/trust-proxy';
import { validationPipe } from '../common/validation';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';

// HTTP real con el servicio simulado (su lógica está en opportunities.service.spec.ts). El usuario de
// la sesión lo simula la cabecera x-test-user. Vitest no emite metadata de tipos: la validación de
// cuerpos se prueba en dto/create-opportunity.dto.spec.ts.

const ID = '6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f';

describe('OpportunitiesController (HTTP)', () => {
  let app: INestApplication;
  let url: string;
  const service = {
    listFeed: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
    listMine: vi.fn().mockResolvedValue({ items: [] }),
    getOwn: vi.fn().mockResolvedValue({ id: ID }),
    getPublic: vi.fn().mockResolvedValue({ id: ID }),
    previewLaborWarnings: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: ID }),
    update: vi.fn().mockResolvedValue({ id: ID }),
    setExactAddress: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue({ status: 'PAUSED' }),
    resume: vi.fn().mockResolvedValue({ status: 'ACTIVE' }),
    close: vi.fn().mockResolvedValue({ status: 'CLOSED' }),
    cancel: vi.fn().mockResolvedValue({ status: 'CANCELLED' }),
  };

  beforeEach(async () => {
    @Module({
      imports: [ThrottlerModule.forRoot(rateLimitOptions)],
      controllers: [OpportunitiesController],
      providers: [{ provide: OpportunitiesService, useValue: service }],
    })
    class TestModule {}

    const nest = await NestFactory.create<NestExpressApplication>(TestModule, { logger: false });
    applyTrustProxy(nest, 1);
    nest.use((req: Request & { user?: { id: string } }, _res: Response, next: NextFunction) => {
      const user = req.headers['x-test-user'];
      if (typeof user === 'string') req.user = { id: user };
      next();
    });
    nest.setGlobalPrefix('v1');
    nest.useGlobalPipes(validationPipe);
    await nest.listen(0, '127.0.0.1');
    app = nest;
    url = `${await nest.getUrl()}/v1/opportunities`;
    vi.clearAllMocks();
  });

  afterEach(() => app.close());

  const send = (
    method: string,
    path: string,
    body?: object,
    user: string | null = 'u1',
    ip = '181.0.0.1',
  ) =>
    fetch(`${url}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': ip,
        ...(user ? { 'x-test-user': user } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  it('el feed y el detalle son públicos', async () => {
    expect((await send('GET', '?mode=tasks', undefined, null)).status).toBe(200);
    expect(service.listFeed).toHaveBeenCalledWith(expect.objectContaining({ mode: 'tasks' }));
    expect((await send('GET', `/${ID}`, undefined, null)).status).toBe(200);
    expect(service.getPublic).toHaveBeenCalledWith(ID);
  });

  it('"mine" no se confunde con un id y exige sesión', async () => {
    expect((await send('GET', '/mine', undefined, null)).status).toBe(401);
    expect((await send('GET', '/mine')).status).toBe(200);
    expect(service.listMine).toHaveBeenCalledWith('u1', expect.anything());
    expect(service.getPublic).not.toHaveBeenCalled();
    expect((await send('GET', `/mine/${ID}`)).status).toBe(200);
    expect(service.getOwn).toHaveBeenCalledWith('u1', ID);
  });

  it('un id que no es UUID responde 400 sin llegar al servicio', async () => {
    expect((await send('GET', '/abc')).status).toBe(400);
    expect((await send('POST', '/abc/pause', { reason: 'motivo' })).status).toBe(400);
    expect(service.getPublic).not.toHaveBeenCalled();
    expect(service.pause).not.toHaveBeenCalled();
  });

  it.each([
    ['POST', '', 'create'],
    ['POST', '/labor-warnings', 'previewLaborWarnings'],
    ['PATCH', `/${ID}`, 'update'],
    ['PUT', `/${ID}/address`, 'setExactAddress'],
    ['POST', `/${ID}/pause`, 'pause'],
    ['POST', `/${ID}/resume`, 'resume'],
    ['POST', `/${ID}/close`, 'close'],
    ['POST', `/${ID}/cancel`, 'cancel'],
  ] as const)('%s %s exige sesión', async (method, path, handler) => {
    expect((await send(method, path, { reason: 'motivo', address: 'x' }, null)).status).toBe(401);
    expect(service[handler]).not.toHaveBeenCalled();
  });

  it('las acciones llevan el usuario de la sesión, no uno del cuerpo', async () => {
    await send('POST', `/${ID}/cancel`, { reason: 'Ya no lo necesito' }, 'u7');
    expect(service.cancel).toHaveBeenCalledWith('u7', ID, 'Ya no lo necesito');
    expect((await send('PUT', `/${ID}/address`, { address: 'Cra 1' }, 'u7')).status).toBe(204);
    expect(service.setExactAddress).toHaveBeenCalledWith('u7', ID, 'Cra 1');
  });

  it('RNF-SEG-08: máximo 10 publicaciones por IP cada 15 minutos', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await send('POST', '', { type: 'TASK' })).status).toBe(201);
    }
    expect((await send('POST', '', { type: 'TASK' })).status).toBe(429);
    expect((await send('POST', '', { type: 'TASK' }, 'u1', '190.0.0.9')).status).toBe(201);
  });
});
