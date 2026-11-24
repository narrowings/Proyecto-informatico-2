import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './notification-bell';

const unreadCount = vi.fn();
const getCurrentUser = vi.fn();
vi.mock('@/lib/api', () => ({
  notificationsApi: { unreadCount: () => unreadCount() },
  sessionApi: { getCurrentUser: () => getCurrentUser() },
}));

beforeEach(() => {
  unreadCount.mockReset();
  getCurrentUser.mockReset().mockResolvedValue({ id: 'u1', name: 'Ana' });
});
afterEach(() => vi.useRealTimers());

describe('HU-014 Campana de notificaciones', () => {
  it('sin sesión no se muestra ni consulta', async () => {
    getCurrentUser.mockResolvedValue(null);
    const { container } = render(<NotificationBell />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(unreadCount).not.toHaveBeenCalled();
  });

  it('muestra 9+ cuando hay más de nueve sin leer', async () => {
    unreadCount.mockResolvedValue({ unread: 12 });
    render(<NotificationBell />);
    expect(await screen.findByText('9+')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAccessibleName('Notificaciones: 12 sin leer');
  });

  it('se actualiza cuando la bandeja avisa de una lectura', async () => {
    unreadCount.mockResolvedValueOnce({ unread: 2 }).mockResolvedValueOnce({ unread: 1 });
    render(<NotificationBell />);
    expect(await screen.findByText('2')).toBeInTheDocument();
    await act(async () => {
      window.dispatchEvent(new Event('red:notifications'));
    });
    expect(await screen.findByText('1')).toBeInTheDocument();
  });

  it('con la pestaña oculta no consulta', async () => {
    unreadCount.mockResolvedValue({ unread: 0 });
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    render(<NotificationBell />);
    await act(async () => {});
    expect(await screen.findByRole('link')).toHaveAccessibleName('Notificaciones');
    expect(unreadCount).not.toHaveBeenCalled();
    visibility.mockRestore();
  });
});
