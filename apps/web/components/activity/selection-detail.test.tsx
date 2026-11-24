import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, it, vi, expect } from 'vitest';
import { activityApi } from '@/lib/api';
import { ApiError } from '@/lib/api/http';
import { SelectionDetail } from './selection-detail';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());
it('explica que una selección ya venció o se respondió al abrir un aviso antiguo', async () => {
  vi.spyOn(activityApi, 'selections').mockResolvedValue([]);
  const accept = vi.spyOn(activityApi, 'accept');
  render(<SelectionDetail id="s" />);
  expect(await screen.findByText('Esta selección ya no está pendiente o venció.')).toBeVisible();
  expect(accept).not.toHaveBeenCalled();
});
it('permite rechazar si el detalle público ya no está disponible', async () => {
  vi.spyOn(activityApi, 'selections').mockResolvedValue([
    {
      id: 's',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      opportunity: { id: 'p', title: 'Tarea', zone: { id: 1, name: 'Centro' }, scheduledAt: null },
    },
  ]);
  vi.spyOn(activityApi, 'details').mockRejectedValue(new ApiError(404, {}, 0));
  const reject = vi.spyOn(activityApi, 'reject').mockResolvedValue(undefined);
  render(<SelectionDetail id="s" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Rechazar selección' }));
  expect(await screen.findByText('Rechazaste la selección.')).toBeVisible();
  expect(reject).toHaveBeenCalledWith('s');
});
