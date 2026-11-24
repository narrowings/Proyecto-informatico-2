import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, it, vi, expect } from 'vitest';
import { notificationsApi, type InboxItem } from '@/lib/api';
import { NotificationInbox } from './notification-inbox';
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
afterEach(() => {
  vi.restoreAllMocks();
  push.mockClear();
});
const item: InboxItem = {
  id: 'n',
  title: 'Tienes una selección',
  type: 'SELECTION_RECEIVED',
  body: 'Organizar archivos',
  createdAt: '2026-01-01T12:00Z',
  link: '/mi-actividad',
  read: false,
};
it('carga más, marca todas y conserva la bandeja ante una ruta externa', async () => {
  vi.spyOn(notificationsApi, 'list')
    .mockResolvedValueOnce({ items: [item], total: 2, page: 1, pageSize: 1, unread: 2 })
    .mockResolvedValueOnce({
      items: [{ ...item, id: 'm', title: 'Trabajo completado' }],
      page: 2,
      total: 2,
      pageSize: 1,
      unread: 2,
    });
  const mark = vi.spyOn(notificationsApi, 'readAll').mockResolvedValue({ updated: 2 });
  vi.spyOn(notificationsApi, 'read').mockResolvedValue({ id: 'n', link: '//example.test' });
  render(<NotificationInbox />);
  fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));
  expect(await screen.findByText('Trabajo completado')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Tienes una selección/ }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Tienes una selección/ })).toHaveAccessibleName(
      /Leída/,
    ),
  );
  expect(push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Marcar todas como leídas' })).toBeDisabled(),
  );
  expect(mark).toHaveBeenCalledTimes(1);
});
it('conserva el aviso sin leer si falla la apertura y navega al enlace devuelto al reintentar', async () => {
  vi.spyOn(notificationsApi, 'list').mockResolvedValue({
    items: [item],
    total: 1,
    page: 1,
    pageSize: 20,
    unread: 1,
  });
  vi.spyOn(notificationsApi, 'read')
    .mockRejectedValueOnce(new Error())
    .mockResolvedValue({ id: 'n', link: '/mi-actividad/selecciones/s' });
  render(<NotificationInbox />);
  fireEvent.click(await screen.findByRole('button', { name: /Tienes una selección/ }));
  expect(await screen.findByRole('alert')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Sin leer.*Tienes una selección/ }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/mi-actividad/selecciones/s'));
});
