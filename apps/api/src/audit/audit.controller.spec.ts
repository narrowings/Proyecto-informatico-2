import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '../common/auth/current-user.decorator';
import { validationPipe } from '../common/validation';
import { IdentityService } from '../identity/identity.service';
import { AdminGuard } from './admin.guard';
import { AUDIT } from './audit.contract';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

describe('HU-012 CA2 y HU-038 CA2 Consulta de auditoría por HTTP', () => {
  let app: INestApplication;
  let url: string;
  const page = { items: [], total: 0, page: 1, pageSize: 20 };
  const service = { list: vi.fn().mockResolvedValue(page) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const identity = { getAccess: vi.fn() };
  const admin = { 'x-test-user': 'admin' };

  beforeAll(async () => {
    @Module({
      controllers: [AuditController],
      providers: [
        AdminGuard,
        { provide: AuditService, useValue: service },
        { provide: AUDIT, useValue: audit },
        { provide: IdentityService, useValue: identity },
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
    url = `${await app.getUrl()}/v1/admin/audit`;
  });

  afterAll(() => app?.close());

  beforeEach(() => {
    vi.clearAllMocks();
    identity.getAccess.mockImplementation(async (id: string) =>
      id === 'admin' ? { role: 'ADMIN', status: 'ACTIVE' } : { role: 'USER', status: 'ACTIVE' },
    );
  });

  it('exige sesión y no registra nada sin usuario', async () => {
    const response = await fetch(url);
    expect(response.status).toBe(401);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('CA2: un usuario sin rol de administrador recibe 403 y el intento queda auditado', async () => {
    const response = await fetch(url, { headers: { 'x-test-user': 'u1' } });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: 'ADMIN_ONLY',
      message: 'Esta sección es solo para administradores',
    });
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'u1',
      action: 'ADMIN_ACCESS_DENIED',
      targetType: 'route',
      targetId: 'GET /v1/admin/audit',
      ip: expect.any(String),
    });
    expect(service.list).not.toHaveBeenCalled();
  });

  it('un administrador suspendido o bloqueado tampoco entra', async () => {
    identity.getAccess.mockResolvedValue({ role: 'ADMIN', status: 'BLOCKED' });
    expect((await fetch(url, { headers: admin })).status).toBe(403);
    identity.getAccess.mockResolvedValue(null);
    expect((await fetch(url, { headers: admin })).status).toBe(403);
  });

  it('el administrador consulta con filtros validados', async () => {
    const query = 'action=USER_BLOCKED&from=2026-11-01T00:00:00Z&page=2&pageSize=5';
    const response = await fetch(`${url}?${query}`, { headers: admin });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_BLOCKED',
        from: '2026-11-01T00:00:00Z',
        page: 2,
        pageSize: 5,
      }),
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it.each([['action=BORRAR_TODO'], ['actorUserId=no-uuid'], ['from=ayer']])(
    'rechaza el filtro inválido %s',
    async (query) => {
      const response = await fetch(`${url}?${query}`, { headers: admin });
      expect(response.status).toBe(400);
      expect(service.list).not.toHaveBeenCalled();
    },
  );

  it('CA3: no hay rutas para modificar ni borrar registros', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await fetch(`${url}/x`, { method, headers: admin });
      expect(response.status).toBe(404);
    }
  });
});
