import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, it, vi, expect } from 'vitest';
import { activityApi, catalogsApi, type OwnedOpportunity } from '@/lib/api';
import { ApiError } from '@/lib/api/http';
import { PublicationDetail } from './publication-detail';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());
const publication: OwnedOpportunity = {
  id: 'p',
  title: 'Organizar archivos',
  description: 'Organizar los archivos físicos del barrio.',
  category: { id: 1, name: 'Servicios' },
  zone: { id: 2, name: 'Centro' },
  type: 'TASK',
  status: 'ACTIVE',
  peopleNeeded: 1,
  paymentCop: 50000,
  scheduledAt: '2099-01-10T14:30:25Z',
  durationMinutes: 60,
  conditions: null,
  salaryMinCop: null,
  salaryMaxCop: null,
  modality: null,
  schedule: null,
  experienceRequired: null,
  requirements: null,
  closesAt: null,
  updatedAt: '2026-01-10T12:00:00Z',
  exactAddress: null,
  statusReason: null,
  hiddenAt: null,
  hiddenReason: null,
};
function setup(p = publication) {
  vi.spyOn(activityApi, 'own').mockResolvedValue(p);
  vi.spyOn(activityApi, 'applicants').mockResolvedValue({ applicants: [], selected: 0, needed: 1 });
  vi.spyOn(catalogsApi, 'listZones').mockResolvedValue([p.zone]);
  vi.spyOn(catalogsApi, 'listCategories').mockResolvedValue([p.category]);
  render(<PublicationDetail id="p" />);
}
it('edita solo el cambio, muestra la advertencia exacta y exige confirmación para reenviar', async () => {
  setup();
  const update = vi
    .spyOn(activityApi, 'update')
    .mockRejectedValueOnce(
      new ApiError(
        409,
        {
          code: 'LABOR_WARNING_REQUIRED',
          warnings: [{ code: 'FULL_DAY', message: 'Texto de la regla vigente' }],
        },
        0,
      ),
    )
    .mockResolvedValue(publication);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar publicación' }));
  const duration = await screen.findByLabelText('Duración en minutos');
  expect(screen.getByLabelText('Fecha y hora de realización (Cali)')).toHaveValue(
    '2099-01-10T09:30',
  );
  fireEvent.change(duration, { target: { value: '480' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(await screen.findByText('Texto de la regla vigente')).toBeVisible();
  expect(update).toHaveBeenCalledWith('p', { durationMinutes: 480 });
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Leí la advertencia sobre relación laboral'));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() =>
    expect(update).toHaveBeenLastCalledWith('p', {
      durationMinutes: 480,
      acknowledgeLaborWarning: true,
    }),
  );
});
it('reactiva sin motivo e informa si primero hay que corregir la fecha', async () => {
  setup({ ...publication, status: 'PAUSED' });
  vi.spyOn(activityApi, 'resume').mockRejectedValue(
    new ApiError(409, { code: 'OPPORTUNITY_DATE_PASSED', message: 'La fecha ya pasó' }, 0),
  );
  fireEvent.change(await screen.findByLabelText('Cambiar estado de la publicación'), {
    target: { value: 'resume' },
  });
  expect(screen.queryByLabelText('Motivo')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio de estado' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('La fecha ya pasó');
});
it('exige motivo al pausar y conserva al dueño la opción de borrar la dirección', async () => {
  setup({ ...publication, exactAddress: 'Calle 5' });
  const address = vi.spyOn(activityApi, 'address').mockResolvedValue(undefined);
  fireEvent.change(await screen.findByLabelText('Cambiar estado de la publicación'), {
    target: { value: 'pause' },
  });
  expect(screen.getByRole('button', { name: 'Confirmar cambio de estado' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Por lluvia' } });
  expect(screen.getByRole('button', { name: 'Confirmar cambio de estado' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Dirección exacta'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar dirección' }));
  await waitFor(() => expect(address).toHaveBeenCalledWith('p', ''));
});
