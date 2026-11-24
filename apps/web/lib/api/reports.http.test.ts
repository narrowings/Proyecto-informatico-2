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
    ).resolves.toEqual({ id: 'r1', message: 'Gracias' });
    expect(String(fetchApi.mock.calls[1][0])).toMatch(/\/v1\/reports$/);
    expect(JSON.parse(String(fetchApi.mock.calls[1][1]?.body))).toEqual({
      targetType: 'USER',
      targetId: 'perfil',
      profileKind: 'WORKER',
      reason: 'SPAM',
    });
  });
});
