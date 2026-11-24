import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, it, vi, expect } from 'vitest';
import { activityApi, type JobDetail as Job } from '@/lib/api';
import { JobDetail } from './job-detail';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());
const job: Job = {
  id: 'j',
  title: 'Ordenar archivos',
  zone: { id: 1, name: 'Centro' },
  scheduledAt: '2027-01-01T12:00Z',
  status: 'SCHEDULED',
  counterparty: { name: 'Ana', phone: '3000000000' },
  exactAddress: 'Calle 2',
  hasRated: false,
  finishMarkedAt: null,
  finishMarkedByMe: false,
  cancelledByMe: false,
  cancelReason: null,
};
it('exige un motivo para cancelar y muestra el historial que devuelve la API', async () => {
  vi.spyOn(activityApi, 'job')
    .mockResolvedValueOnce(job)
    .mockResolvedValue({
      ...job,
      status: 'CANCELLED',
      cancelledByMe: true,
      cancelReason: 'Cambio de fecha',
    });
  const cancel = vi.spyOn(activityApi, 'cancelJob').mockResolvedValue(undefined);
  render(<JobDetail id="j" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Cancelar trabajo' }));
  expect(screen.getByRole('button', { name: 'Confirmar cancelación' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Motivo de la cancelación'), {
    target: { value: 'Cambio de fecha' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));
  await waitFor(() => expect(cancel).toHaveBeenCalledWith('j', 'Cambio de fecha'));
  expect(await screen.findByText('Cancelaste el trabajo. Motivo: Cambio de fecha')).toBeVisible();
});
it('quien marcó el trabajo no puede confirmarlo ni calificar antes de tiempo', async () => {
  vi.spyOn(activityApi, 'job').mockResolvedValue({
    ...job,
    status: 'IN_PROGRESS',
    finishMarkedAt: '2026-11-23T12:00Z',
    finishMarkedByMe: true,
  });
  render(<JobDetail id="j" />);
  expect(await screen.findByText('La otra parte debe confirmar la finalización.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Confirmar finalización' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Calificar el trabajo' })).toBeNull();
});
