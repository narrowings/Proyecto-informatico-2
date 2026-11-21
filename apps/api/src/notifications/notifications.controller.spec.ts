import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '../common/auth/current-user.decorator';
import { validationPipe } from '../common/validation';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('HU-014 CA5 y RF-07-07 Bandeja por HTTP', () => {
  let app: INestApplication;
  let url: string;
  const id = '6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f';
  const headers = { 'x-test-user': 'u' };
  const service = {
    listOwn: vi.fn().mockResolvedValue({ items: [], total: 3, unread: 1, page: 2, pageSize: 2 }),
    getUnreadCount: vi.fn().mockResolvedValue({ unread: 1 }),
    markAsRead: vi.fn().mockResolvedValue({ id, link: '/mi-actividad' }),
    markAllAsRead: vi.fn().mockResolvedValue({ updated: 1 }),
  };

  beforeAll(async () => {
    @Module({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
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
    url = `${await app.getUrl()}/v1/notifications`;
  });

  afterAll(() => app?.close());

  it.each([
    ['GET', ''],
    ['GET', '/unread-count'],
    ['POST', `/${id}/read`],
    ['POST', '/read-all'],
  ])('exige sesión para %s /notifications%s', async (method, path) => {
    const response = await fetch(url + path, { method });
    expect(response.status).toBe(401);
  });

  it('pasa la identidad autenticada y la paginación validada al servicio', async () => {
    const response = await fetch(`${url}?page=2&pageSize=2`, { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [], total: 3, unread: 1, page: 2, pageSize: 2 });
    expect(service.listOwn).toHaveBeenCalledWith('u', { page: 2, pageSize: 2 });
  });

  it('rechaza un tamaño de página superior a 50', async () => {
    const response = await fetch(`${url}?pageSize=51`, { headers });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errors: { pageSize: expect.any(Array) } });
  });

  it('rechaza un identificador que no es UUID sin llamar al servicio', async () => {
    service.markAsRead.mockClear();
    const response = await fetch(`${url}/incorrecto/read`, { method: 'POST', headers });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errors: { id: expect.any(Array) } });
    expect(service.markAsRead).not.toHaveBeenCalled();
  });

  it('devuelve el enlace de la notificación propia al marcarla como leída', async () => {
    const response = await fetch(`${url}/${id}/read`, { method: 'POST', headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id, link: '/mi-actividad' });
    expect(service.markAsRead).toHaveBeenCalledWith('u', id);
  });

  it('expone el contador y el total actualizado al marcar todas las propias', async () => {
    const count = await fetch(`${url}/unread-count`, { headers });
    expect(count.status).toBe(200);
    expect(await count.json()).toEqual({ unread: 1 });
    expect(service.getUnreadCount).toHaveBeenCalledWith('u');

    const readAll = await fetch(`${url}/read-all`, { method: 'POST', headers });
    expect(readAll.status).toBe(200);
    expect(await readAll.json()).toEqual({ updated: 1 });
    expect(service.markAllAsRead).toHaveBeenCalledWith('u');
  });
});
