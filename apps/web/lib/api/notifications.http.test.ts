import { afterEach, it, expect, vi } from 'vitest';
import { notificationsApi } from './notifications.http';
afterEach(() => vi.unstubAllGlobals());
it('consulta y marca notificaciones con el token de la sesión', async () => {
  const mocked = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ accessToken: 'token' }))
    .mockImplementation(async () => Response.json({}));
  vi.stubGlobal('fetch', mocked);
  await notificationsApi.unreadCount();
  await notificationsApi.list(2);
  await notificationsApi.markAsRead('6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f');
  await notificationsApi.markAllAsRead();
  expect(
    mocked.mock.calls
      .slice(1)
      .map(([url, init]) => [
        new URL(String(url)).pathname + new URL(String(url)).search,
        init?.method ?? 'GET',
        new Headers(init?.headers).get('authorization'),
      ]),
  ).toEqual([
    ['/v1/notifications/unread-count', 'GET', 'Bearer token'],
    ['/v1/notifications?page=2&pageSize=20', 'GET', 'Bearer token'],
    ['/v1/notifications/6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f/read', 'POST', 'Bearer token'],
    ['/v1/notifications/read-all', 'POST', 'Bearer token'],
  ]);
  mocked.mockResolvedValueOnce(
    Response.json({ message: 'Espera' }, { status: 429, headers: { 'retry-after-ip': '22' } }),
  );
  await expect(notificationsApi.list(1)).rejects.toMatchObject({ status: 429, retryAfter: 22 });
});
