import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnWorkerProfile } from '@/lib/api';
import { changedFields, WorkerProfileEditForm } from './worker-profile-edit-form';

const updateWorkerProfile = vi.fn();
vi.mock('@/lib/api', () => ({
  profilesApi: { updateWorkerProfile: (...args: unknown[]) => updateWorkerProfile(...args) },
}));

const own: OwnWorkerProfile = {
  id: 'w1',
  displayName: 'Ana Pérez',
  photoUrl: '/v1/profiles/worker/w1/photo',
  skills: ['Logística'],
  experience: 'Dos años en trasteos.',
  zoneId: 2,
  zone: { id: 2, name: 'Sur' },
  categoryIds: [1],
  categories: [{ id: 1, name: 'Trasteos y logística' }],
  availability: 'AVAILABLE',
  showPhoto: true,
  showExperience: true,
};

const zones = [
  { id: 1, name: 'Norte' },
  { id: 2, name: 'Sur' },
];
const categories = [
  { id: 1, name: 'Trasteos y logística' },
  { id: 2, name: 'Eventos' },
];

const onSaved = vi.fn();
const save = () => screen.getByRole('button', { name: /guardar cambios/i });

function renderForm() {
  render(
    <WorkerProfileEditForm profile={own} zones={zones} categories={categories} onSaved={onSaved} />,
  );
  return userEvent.setup();
}

beforeEach(() => {
  updateWorkerProfile.mockReset();
  onSaved.mockReset();
});

describe('changedFields', () => {
  it('solo incluye lo que cambió; vaciar la experiencia la borra', () => {
    const values = {
      displayName: 'Ana Pérez',
      skills: ['Logística'],
      experience: '',
      categoryIds: [1],
      zoneId: '1',
    };
    expect(changedFields(own, values)).toEqual({ experience: '', zoneId: 1 });
  });

  it('el orden de las categorías no cuenta como cambio', () => {
    const saved = { ...own, categoryIds: [2, 10] };
    expect(
      changedFields(saved, {
        displayName: own.displayName,
        skills: own.skills,
        experience: own.experience ?? '',
        categoryIds: [10, 2],
        zoneId: '2',
      }),
    ).toEqual({});
  });
});

describe('WorkerProfileEditForm', () => {
  it('guarda solo los campos modificados y avisa (HU-032 CA1)', async () => {
    updateWorkerProfile.mockResolvedValue({
      ok: true,
      profile: { ...own, skills: ['Logística', 'Pintura'], categoryIds: [1, 2] },
    });
    const user = renderForm();

    await user.type(screen.getByLabelText('Habilidades'), 'Pintura{Enter}');
    await user.click(screen.getByLabelText('Eventos'));
    await user.click(save());

    expect(updateWorkerProfile).toHaveBeenCalledWith({
      skills: ['Logística', 'Pintura'],
      categoryIds: [1, 2],
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/guardamos los cambios/i);
    expect(onSaved).toHaveBeenCalled();
  });

  it('sin cambios no llama al API', async () => {
    const user = renderForm();
    await user.click(save());
    expect(await screen.findByRole('status')).toHaveTextContent(/no hay cambios/i);
    expect(updateWorkerProfile).not.toHaveBeenCalled();
  });

  it('aplica las mismas reglas que al crear el perfil', async () => {
    const user = renderForm();
    await user.click(screen.getByRole('button', { name: 'Quitar Logística' }));
    await user.click(save());

    expect(await screen.findByText('Agrega al menos una habilidad.')).toBeInTheDocument();
    expect(updateWorkerProfile).not.toHaveBeenCalled();
  });

  it('muestra bajo cada campo los errores que devuelve el API', async () => {
    updateWorkerProfile.mockResolvedValue({
      ok: false,
      errors: { zoneId: ['Elige una zona de Cali de la lista'] },
    });
    const user = renderForm();
    await user.selectOptions(screen.getByLabelText(/zona de cali/i), 'Norte');
    await user.click(save());

    expect(await screen.findByText('Elige una zona de Cali de la lista')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
