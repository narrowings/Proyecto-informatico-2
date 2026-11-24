import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminResultMessage, moderationPath } from './admin';

const fetchApi = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.resetModules();
  fetchApi.mockReset();
  vi.stubGlobal('fetch', fetchApi);
});
afterEach(() => vi.unstubAllGlobals());

const ID = '6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f';
const respond = (body: unknown, status = 200) =>
  fetchApi
    .mockResolvedValueOnce(Response.json({ accessToken: 'jwt' }))
    .mockResolvedValueOnce(Response.json(body, { status }));

describe('Cliente del panel de administración', () => {
  it('arma la ruta de cada acción de moderación', () => {
    expect(moderationPath({ kind: 'hide', opportunityId: ID })).toBe(
      `/admin/opportunities/${ID}/hide`,
    );
    expect(moderationPath({ kind: 'reactivate', userId: ID })).toBe(
      `/admin/users/${ID}/reactivate`,
    );
    expect(moderationPath({ kind: 'dismiss', targetType: 'USER', targetId: ID })).toBe(
      `/admin/reports/USER/${ID}/dismiss`,
    );
  });

  it('envía el motivo con POST y responde ok', async () => {
    const { adminApi } = await import('./admin.http');
    respond({ id: ID, status: 'BLOCKED' }, 201);
    await expect(
      adminApi.moderate({ kind: 'block', userId: ID }, 'Fraude reiterado'),
    ).resolves.toEqual({ status: 'ok' });
    const [url, init] = fetchApi.mock.calls[1];
    expect(String(url)).toMatch(new RegExp(`/v1/admin/users/${ID}/block$`));
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ reason: 'Fraude reiterado' });
  });

  it.each([
    [409, { code: 'ALREADY_HIDDEN' }, { status: 'already_hidden' }],
    [409, { code: 'INVALID_ACCOUNT_STATE' }, { status: 'invalid_account_state' }],
    [400, { code: 'CANNOT_MODERATE_ADMIN' }, { status: 'cannot_moderate_admin' }],
    [409, { code: 'CATEGORY_EXISTS' }, { status: 'category_exists' }],
    [403, { code: 'ADMIN_ONLY' }, { status: 'forbidden' }],
    [404, {}, { status: 'not_found' }],
    [400, { errors: { reason: ['Corto'] } }, { status: 'invalid', errors: { reason: ['Corto'] } }],
  ])('traduce %s %j a un estado', async (status, problem, expected) => {
    const { adminApi } = await import('./admin.http');
    respond(problem, status);
    await expect(adminApi.updateCategory(3, { isActive: false })).resolves.toEqual(expected);
    expect(fetchApi.mock.calls[1][1]?.method).toBe('PATCH');
  });

  it('un error del servidor sigue siendo una excepción', async () => {
    const { adminApi } = await import('./admin.http');
    respond({}, 500);
    await expect(adminApi.createCategory({ name: 'Mascotas' })).rejects.toThrow();
  });

  it('cada estado tiene un mensaje para el administrador', () => {
    expect(adminResultMessage({ status: 'ok' })).toBeNull();
    expect(adminResultMessage({ status: 'cannot_moderate_admin' })).toBe(
      'No puedes moderar una cuenta administradora.',
    );
    expect(adminResultMessage({ status: 'invalid', errors: { name: ['Muy corto'] } })).toBe(
      'Muy corto',
    );
  });
});
