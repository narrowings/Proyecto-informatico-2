import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, it, vi, expect } from 'vitest';
import { activityApi, type Candidate, type Reputation } from '@/lib/api';
import { Applicants } from './applicants';
import { ApiError } from '@/lib/api/http';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());
const candidate: Candidate = {
  id: 'a',
  workerProfileId: 'w',
  status: 'RECEIVED',
  worker: {
    displayName: 'Ana Pérez',
    photoUrl: null,
    zone: { id: 1, name: 'Centro' },
    availability: 'AVAILABLE',
    skills: ['Cocina'],
  },
};
const reputation: Reputation = {
  average: null,
  ratingsCount: 0,
  completedJobs: 0,
  isNew: true,
  recentComments: [],
  fulfillment: null,
  quality: null,
  punctuality: null,
  communication: null,
};
it('limita la selección por los cupos libres y muestra cambios concurrentes del servidor', async () => {
  const row = { ...candidate, selectionStatus: null, reputation };
  vi.spyOn(activityApi, 'applicants').mockResolvedValue({
    selected: 1,
    needed: 2,
    applicants: [row, { ...row, id: 'b', worker: { ...row.worker, displayName: 'Luis' } }],
  });
  const select = vi
    .spyOn(activityApi, 'select')
    .mockRejectedValue(new ApiError(409, { message: 'Ya no quedan cupos' }, 0));
  render(<Applicants id="p" formal={false} open />);
  fireEvent.click(await screen.findByLabelText('Seleccionar a Ana Pérez'));
  expect(screen.getByLabelText('Seleccionar a Luis')).toBeDisabled();
  expect(screen.getByRole('link', { name: 'Ana Pérez' })).toHaveAttribute(
    'href',
    '/trabajadores/w',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Enviar selección (1)' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Ya no quedan cupos');
  expect(select).toHaveBeenCalledWith('p', ['a']);
});
it('permite cambiar el estado del postulante e impide modificar decisiones finales', async () => {
  vi.spyOn(activityApi, 'candidates')
    .mockResolvedValueOnce([candidate])
    .mockResolvedValue([{ ...candidate, status: 'ACCEPTED' }]);
  const change = vi
    .spyOn(activityApi, 'changeCandidate')
    .mockResolvedValue({ id: 'a', status: 'ACCEPTED' });
  render(<Applicants id="p" formal open />);
  fireEvent.change(await screen.findByLabelText('Cambiar estado de Ana Pérez'), {
    target: { value: 'ACCEPTED' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar estado' }));
  await waitFor(() => expect(change).toHaveBeenCalledWith('a', 'ACCEPTED'));
  expect(await screen.findByText('Postulación: Aceptada')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Guardar estado' })).toBeNull();
});
