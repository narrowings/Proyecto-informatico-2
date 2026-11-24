import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { OpportunityFeed } from './opportunity-feed';

const mocks = vi.hoisted(() => ({ list: vi.fn(), applicationStatus: vi.fn(), replace: vi.fn() }));
vi.mock('@/lib/api', () => ({
  opportunitiesApi: mocks,
  catalogsApi: {
    listZones: async () => [{ id: 1, name: 'Centro' }],
    listCategories: async () => [{ id: 1, name: 'Servicios' }],
  },
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/trabajar',
  useRouter: () => ({ replace: mocks.replace }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  mocks.applicationStatus.mockResolvedValue({});
});
it('muestra vacío y filtra por zona, texto y modo', async () => {
  render(<OpportunityFeed />);
  await screen.findByText('No hay oportunidades con estos filtros');
  fireEvent.change(await screen.findByLabelText('Zona'), { target: { value: '1' } });
  await waitFor(() =>
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ zoneId: 1 })),
  );
  fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'cajas' } });
  await waitFor(() =>
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'cajas' })),
  );
  fireEvent.click(screen.getByText('Empleo formal'));
  expect(mocks.replace).toHaveBeenCalledWith('/trabajar?modo=formal');
});
it('permite reintentar después de un error resuelto por el cliente', async () => {
  mocks.list.mockResolvedValueOnce({ status: 'error' });
  render(<OpportunityFeed />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await screen.findByText('No hay oportunidades con estos filtros');
  expect(mocks.list).toHaveBeenCalledTimes(2);
});

it('envía pago y tipo, y elimina los filtros al limpiar', async () => {
  render(<OpportunityFeed />);
  await screen.findByText('No hay oportunidades con estos filtros');
  fireEvent.change(screen.getByLabelText('Pago mínimo'), { target: { value: '50000' } });
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'TASK' } });
  await waitFor(() =>
    expect(mocks.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ paymentMin: 50000, type: 'TASK' }),
    ),
  );
  fireEvent.click(screen.getByText('Limpiar filtros'));
  await waitFor(() =>
    expect(mocks.list).toHaveBeenLastCalledWith({
      mode: 'tasks',
      q: undefined,
      page: 1,
      pageSize: 20,
    }),
  );
});

it('muestra tarjetas, marca postulaciones y carga otra página', async () => {
  const item = {
    id: 'uno',
    title: 'Cargar cajas',
    type: 'TASK',
    zone: { name: 'Centro' },
    paymentCop: 50000,
    publisher: { displayName: 'Ana', photoUrl: null },
    scheduledAt: '2099-01-01T15:00:00Z',
  };
  mocks.list
    .mockResolvedValueOnce({ items: [item], total: 2, page: 1, pageSize: 1 })
    .mockResolvedValue({
      items: [{ ...item, id: 'dos', title: 'Otra tarea' }],
      total: 2,
      page: 2,
      pageSize: 1,
    });
  mocks.applicationStatus.mockResolvedValue({ uno: 'RECEIVED' });
  render(<OpportunityFeed />);
  await screen.findByText('Ya te postulaste');
  expect(screen.getByRole('link')).toHaveAttribute('href', '/oportunidades/uno');
  fireEvent.click(screen.getByText('Cargar más'));
  await screen.findByText('Otra tarea');
  expect(screen.getByText('Cargar cajas')).toBeInTheDocument();
});
