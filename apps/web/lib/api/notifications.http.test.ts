import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchApi = vi.fn<typeof fetch>();
const id = '6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f';
beforeEach(() => {
  vi.resetModules();
  fetchApi.mockReset();
  vi.stubGlobal('fetch', fetchApi);
});
afterEach(() => vi.unstubAllGlobals());

describe('Notificaciones HTTP', () => {
  it('consulta y marca las notificaciones con sesión', async () => {
    const { notificationsApi } = await import('./notifications.http');
    fetchApi
      .mockResolvedValueOnce(Response.json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(
        Response.json({ items: [], total: 0, unread: 0, page: 1, pageSize: 20 }),
      )
      .mockResolvedValueOnce(Response.json({ id, link: '/mi-actividad' }));
    await notificationsApi.list(1);
    expect(String(fetchApi.mock.calls[1][0])).toMatch(/\/v1\/notifications\?page=1&pageSize=20$/);
    await expect(notificationsApi.markAsRead(id)).resolves.toEqual({ id, link: '/mi-actividad' });
    expect(String(fetchApi.mock.calls[2][0])).toMatch(new RegExp(`/v1/notifications/${id}/read$`));
  });
});
