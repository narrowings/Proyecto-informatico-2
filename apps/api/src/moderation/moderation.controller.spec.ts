import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminGuard } from '../audit/admin.guard';
import { AUDIT } from '../audit/audit.contract';
import type { AuthenticatedRequest } from '../common/auth/current-user.decorator';
import { validationPipe } from '../common/validation';
import { IdentityService } from '../identity/identity.service';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

const ID = '11111111-1111-4111-8111-111111111111';
const reason = { reason: 'Contenido engañoso para los trabajadores' };

describe('HU-012 Panel de moderación por HTTP', () => {
  let app: INestApplication;
  let url: string;
  const service = {
    listReports: vi.fn().mockResolvedValue({ items: [] }),
    reportDetail: vi.fn().mockResolvedValue({}),
    hideOpportunity: vi.fn().mockResolvedValue({ id: ID, hidden: true }),
    unhideOpportunity: vi.fn().mockResolvedValue({}),
    listUsers: vi.fn().mockResolvedValue({ items: [] }),
    suspendUser: vi.fn().mockResolvedValue({}),
    blockUser: vi.fn().mockResolvedValue({}),
    reactivateUser: vi.fn().mockResolvedValue({}),
    dismissReports: vi.fn().mockResolvedValue({ dismissed: 1 }),
  };
  const identity = { getAccess: vi.fn() };
  const audit = { record: vi.fn() };
  const admin = { 'x-test-user': 'admin', 'content-type': 'application/json' };

  beforeAll(async () => {
    @Module({
      controllers: [ModerationController],
      providers: [
        AdminGuard,
        { provide: ModerationService, useValue: service },
        { provide: IdentityService, useValue: identity },
        { provide: AUDIT, useValue: audit },
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
    url = `${await app.getUrl()}/v1/admin`;
  });

  afterAll(() => app?.close());

  beforeEach(() => {
    vi.clearAllMocks();
    identity.getAccess.mockImplementation(async (id: string) => ({
      role: id === 'admin' ? 'ADMIN' : 'USER',
      status: 'ACTIVE',
    }));
  });

  const routes = [
    ['GET', '/reports'],
    ['GET', `/reports/USER/${ID}`],
    ['POST', `/opportunities/${ID}/hide`],
    ['POST', `/opportunities/${ID}/unhide`],
    ['GET', '/users'],
    ['POST', `/users/${ID}/suspend`],
    ['POST', `/users/${ID}/block`],
    ['POST', `/users/${ID}/reactivate`],
    ['POST', `/reports/OPPORTUNITY/${ID}/dismiss`],
  ];

  it.each(routes)(
    '%s %s: 401 sin sesión y 403 auditado sin rol administrador',
    async (method, path) => {
      const body = method === 'POST' ? JSON.stringify(reason) : undefined;
      expect((await fetch(url + path, { method, body })).status).toBe(401);
      const response = await fetch(url + path, {
        method,
        body,
        headers: { 'x-test-user': 'u1', 'content-type': 'application/json' },
      });
      expect(response.status).toBe(403);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ actorUserId: 'u1', action: 'ADMIN_ACCESS_DENIED' }),
      );
      for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
    },
  );

  it.each(routes.filter(([method]) => method === 'POST'))(
    '%s %s exige un motivo de al menos 10 caracteres',
    async (method, path) => {
      for (const body of [{}, { reason: '   corto   ' }, { reason: 'x'.repeat(501) }]) {
        const response = await fetch(url + path, {
          method,
          headers: admin,
          body: JSON.stringify(body),
        });
        expect(response.status).toBe(400);
      }
      for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
    },
  );

  it('oculta pasando administrador, id, motivo recortado e IP', async () => {
    const response = await fetch(`${url}/opportunities/${ID}/hide`, {
      method: 'POST',
      headers: admin,
      body: JSON.stringify({ reason: `  ${reason.reason}  ` }),
    });
    expect(response.status).toBe(201);
    expect(service.hideOpportunity).toHaveBeenCalledWith(
      'admin',
      ID,
      reason.reason,
      expect.any(String),
    );
  });

  it('rechaza ids que no son UUID y tipos de elemento inválidos', async () => {
    const bad = [
      ['POST', '/users/no-uuid/block'],
      ['GET', `/reports/MENSAJE/${ID}`],
      ['POST', `/reports/MENSAJE/${ID}/dismiss`],
    ];
    for (const [method, path] of bad) {
      const response = await fetch(url + path, {
        method,
        headers: admin,
        body: method === 'POST' ? JSON.stringify(reason) : undefined,
      });
      expect(response.status).toBe(400);
    }
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });

  it('valida los filtros de la cola y de la búsqueda de usuarios', async () => {
    expect((await fetch(`${url}/reports?status=CERRADO`, { headers: admin })).status).toBe(400);
    expect((await fetch(`${url}/users?q=${'a'.repeat(101)}`, { headers: admin })).status).toBe(400);
    const ok = await fetch(`${url}/users?q=ana&status=BLOCKED&page=2`, { headers: admin });
    expect(ok.status).toBe(200);
    expect(service.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'ana', status: 'BLOCKED', page: 2 }),
    );
  });
});
