import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, it, vi, expect } from 'vitest';
import { activityApi } from '@/lib/api';
import { ActivityDashboard } from './activity-dashboard';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());
it('consulta los dos roles y filtros, ofrece destinos en el estado vacío y conserva la reputación', async () => {
  const none = { items: [], page: 1, pageSize: 20, total: 0 };
  const applications = vi.spyOn(activityApi, 'applications').mockResolvedValue(none);
  const jobs = vi.spyOn(activityApi, 'jobs').mockResolvedValue(none);
  render(<ActivityDashboard />);
  expect(await screen.findByRole('link', { name: 'Explorar oportunidades' })).toHaveAttribute(
    'href',
    '/trabajar',
  );
  fireEvent.change(screen.getByLabelText('Postulaciones'), { target: { value: 'all' } });
  await waitFor(() => expect(applications).toHaveBeenCalledWith('all', 1));
  fireEvent.change(screen.getByLabelText('Consultar'), { target: { value: 'jobs' } });
  fireEvent.change(screen.getByLabelText('Mi rol'), { target: { value: 'publisher' } });
  fireEvent.change(screen.getByLabelText('Trabajos'), { target: { value: 'finished' } });
  await waitFor(() => expect(jobs).toHaveBeenCalledWith('publisher', 'finished', 1));
  expect(await screen.findByText('No tienes trabajos en esta vista.')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Ver mi reputación y calificaciones' })).toHaveAttribute(
    'href',
    '/mi-actividad/reputacion',
  );
});
it('reintenta una carga fallida sin cambiar de pantalla', async () => {
  vi.spyOn(activityApi, 'applications')
    .mockRejectedValueOnce(new Error())
    .mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
  render(<ActivityDashboard />);
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByRole('link', { name: 'Explorar oportunidades' })).toBeVisible();
});
