import { act, render, screen } from '@testing-library/react';
import { afterEach, it, vi, expect } from 'vitest';
import { notificationsApi } from '@/lib/api';
import * as session from '@/lib/session/use-current-user';
import { NotificationBell, inboxChanged } from './notification-bell';
vi.mock('next/navigation', () => ({ usePathname: () => '/mi-actividad' }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it('no consulta las notificaciones cuando falta sesión', () => {
  vi.spyOn(session, 'useCurrentUser').mockReturnValue({ status: 'ready', user: null });
  const count = vi.spyOn(notificationsApi, 'unreadCount');
  render(<NotificationBell />);
  expect(count).not.toHaveBeenCalled();
  expect(screen.queryByRole('link')).toBeNull();
});
it('cuenta solo con la pestaña visible y actualiza la campana al leer', async () => {
  vi.useFakeTimers();
  vi.spyOn(session, 'useCurrentUser').mockReturnValue({
    status: 'ready',
    user: { id: 'u', name: 'Ana', hasWorkerProfile: true, hasPublisherProfile: false },
  });
  const visible = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const count = vi.spyOn(notificationsApi, 'unreadCount').mockResolvedValue({ unread: 12 });
  render(<NotificationBell />);
  await act(() => Promise.resolve());
  expect(screen.getByRole('link', { name: 'Notificaciones, 12 sin leer' })).toHaveTextContent('9+');
  await act(() => vi.advanceTimersByTimeAsync(30000));
  expect(count).toHaveBeenCalledTimes(2);
  visible.mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
  await act(() => vi.advanceTimersByTimeAsync(60000));
  expect(count).toHaveBeenCalledTimes(2);
  visible.mockReturnValue('visible');
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  count.mockResolvedValue({ unread: 0 });
  await act(async () => {
    window.dispatchEvent(new Event(inboxChanged));
  });
  expect(screen.getByRole('link', { name: 'Notificaciones' })).toHaveTextContent('');
});
