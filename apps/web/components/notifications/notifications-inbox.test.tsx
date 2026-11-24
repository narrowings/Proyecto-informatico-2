import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '@/lib/api';
import { NotificationsInbox } from './notifications-inbox';

const list = vi.fn();
const markAsRead = vi.fn();
const markAllAsRead = vi.fn();
vi.mock('@/lib/api', () => ({
  notificationsApi: {
    list: (...args: unknown[]) => list(...args),
    markAsRead: (...args: unknown[]) => markAsRead(...args),
    markAllAsRead: () => markAllAsRead(),
  },
}));
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const item = (id: string, overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id,
  type: 'NEW_APPLICANT',
  title: `Aviso ${id}`,
  body: 'Tienes un nuevo interesado',
  link: '/mi-actividad',
  read: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});
const page = (items: NotificationItem[], total = items.length, number = 1) => ({
  items,
  total,
  unread: items.filter((i) => !i.read).length,
  page: number,
  pageSize: 20,
});

beforeEach(() => {
  list.mockReset();
  markAsRead.mockReset();
  markAllAsRead.mockReset();
  push.mockReset();
});

describe('HU-014 CA5 Bandeja de notificaciones', () => {
  it('muestra el estado vacío', async () => {
    list.mockResolvedValue(page([]));
    render(<NotificationsInbox />);
    expect(await screen.findByText('No tienes notificaciones todavía.')).toBeInTheDocument();
  });

  it('con error permite reintentar', async () => {
    list.mockRejectedValueOnce(new Error('red')).mockResolvedValueOnce(page([item('a')]));
    render(<NotificationsInbox />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Aviso a')).toBeInTheDocument();
  });

  it('al abrir una no leída la marca, avisa a la campana y navega a su ruta interna', async () => {
    list.mockResolvedValue(page([item('a')]));
    markAsRead.mockResolvedValue({ id: 'a', link: '/mi-actividad' });
    const bell = vi.fn();
    window.addEventListener('red:notifications', bell);
    render(<NotificationsInbox />);
    await userEvent.click(await screen.findByRole('button', { name: /Aviso a/ }));
    expect(markAsRead).toHaveBeenCalledWith('a');
    expect(bell).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/mi-actividad');
    window.removeEventListener('red:notifications', bell);
  });

  it('nunca navega a un enlace externo', async () => {
    list.mockResolvedValue(page([item('a', { read: true, link: '//evil.com' })]));
    render(<NotificationsInbox />);
    await userEvent.click(await screen.findByRole('button', { name: /Aviso a/ }));
    expect(markAsRead).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('carga más páginas y marca todas como leídas; si falla lo dice sin perder la lista', async () => {
    list.mockResolvedValueOnce(page([item('a')], 2)).mockResolvedValueOnce(page([item('b')], 2, 2));
    render(<NotificationsInbox />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));
    expect(await screen.findByText('Aviso b')).toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith(2);
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();

    markAllAsRead.mockRejectedValueOnce(new Error('red'));
    await userEvent.click(screen.getByRole('button', { name: 'Marcar todas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos completar');
    expect(screen.getByText('Aviso a')).toBeInTheDocument();
  });
});
