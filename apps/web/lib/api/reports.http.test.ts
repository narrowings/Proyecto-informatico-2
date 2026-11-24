import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchApi = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.resetModules();
  fetchApi.mockReset();
  vi.stubGlobal('fetch', fetchApi);
});
afterEach(() => vi.unstubAllGlobals());

describe('Reportes HTTP', () => {
  it('envía el perfil y el motivo a la ruta autenticada', async () => {
    const { reportsApi } = await import('./reports.http');
    fetchApi
      .mockResolvedValueOnce(Response.json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(Response.json({ id: 'r1', message: 'Gracias' }, { status: 201 }));
    await expect(
      reportsApi.create({
        targetType: 'USER',
        targetId: 'perfil',
        profileKind: 'WORKER',
        reason: 'SPAM',
      }),
    ).resolves.toEqual({ status: 'reported', message: 'Gracias' });
    expect(String(fetchApi.mock.calls[1][0])).toMatch(/\/v1\/reports$/);
    expect(JSON.parse(String(fetchApi.mock.calls[1][1]?.body))).toEqual({
      targetType: 'USER',
      targetId: 'perfil',
      profileKind: 'WORKER',
      reason: 'SPAM',
    });
  });

  it.each([
    [409, { code: 'ALREADY_REPORTED' }, { status: 'already_reported' }],
    [400, { code: 'CANNOT_REPORT_SELF' }, { status: 'cannot_report_self' }],
    [404, {}, { status: 'not_found' }],
    [429, {}, { status: 'rate_limited' }],
    [
      400,
      { errors: { description: ['Mínimo 10'] } },
      { status: 'invalid', errors: { description: ['Mínimo 10'] } },
    ],
  ])('traduce la respuesta %s a un estado', async (status, problem, expected) => {
    const { reportsApi } = await import('./reports.http');
    fetchApi
      .mockResolvedValueOnce(Response.json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(Response.json(problem, { status }));
    await expect(
      reportsApi.create({ targetType: 'OPPORTUNITY', targetId: 'x', reason: 'SPAM' }),
    ).resolves.toEqual(expected);
  });

  it('un error del servidor sigue siendo una excepción', async () => {
    const { reportsApi } = await import('./reports.http');
    fetchApi
      .mockResolvedValueOnce(Response.json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(Response.json({}, { status: 500 }));
    await expect(
      reportsApi.create({ targetType: 'OPPORTUNITY', targetId: 'x', reason: 'SPAM' }),
    ).rejects.toThrow();
  });
});
