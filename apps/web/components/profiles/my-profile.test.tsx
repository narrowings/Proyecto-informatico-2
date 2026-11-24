import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnWorkerProfile } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import { MyProfile } from './my-profile';

const replace = vi.fn();
const getCurrentUser = vi.fn();
const getOwnWorkerProfile = vi.fn();
const updateWorkerProfile = vi.fn();
const replaceWorkerPhoto = vi.fn();
const getOwnWorkerPhoto = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api', () => ({
  sessionApi: { getCurrentUser: () => getCurrentUser() },
  catalogsApi: {
    listZones: async () => [
      { id: 1, name: 'Norte' },
      { id: 2, name: 'Sur' },
    ],
    listCategories: async () => [
      { id: 1, name: 'Trasteos y logística' },
      { id: 2, name: 'Eventos' },
    ],
  },
  profilesApi: {
    getOwnWorkerProfile: () => getOwnWorkerProfile(),
    updateWorkerProfile: (...args: unknown[]) => updateWorkerProfile(...args),
    replaceWorkerPhoto: (...args: unknown[]) => replaceWorkerPhoto(...args),
    getOwnWorkerPhoto: () => getOwnWorkerPhoto(),
  },
}));

const user = (hasWorkerProfile = true) => ({
  id: 'u1',
  name: 'Ana Pérez',
  hasWorkerProfile,
  hasPublisherProfile: false,
});

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

async function renderProfile() {
  const actor = userEvent.setup();
  render(<MyProfile />);
  await screen.findByRole('heading', { level: 1, name: 'Ana Pérez' });
  return actor;
}

beforeEach(() => {
  for (const fn of [
    replace,
    getCurrentUser,
    getOwnWorkerProfile,
    updateWorkerProfile,
    replaceWorkerPhoto,
    getOwnWorkerPhoto,
  ])
    fn.mockReset();
  getCurrentUser.mockResolvedValue(user());
  getOwnWorkerProfile.mockResolvedValue(own);
  getOwnWorkerPhoto.mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
});

describe('MyProfile', () => {
  it('cambia a "No disponible" y lo refleja (HU-032 CA2)', async () => {
    updateWorkerProfile.mockResolvedValue({
      ok: true,
      profile: { ...own, availability: 'UNAVAILABLE' },
    });
    const actor = await renderProfile();
    const toggle = screen.getByRole('switch', { name: /disponible para trabajar/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await actor.click(toggle);

    expect(updateWorkerProfile).toHaveBeenCalledWith({ availability: 'UNAVAILABLE' });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByText('No disponible')).toBeInTheDocument();
  });

  it('elige qué datos opcionales mostrar en el perfil público (HU-030 CA4)', async () => {
    updateWorkerProfile.mockResolvedValue({ ok: true, profile: { ...own, showPhoto: false } });
    const actor = await renderProfile();

    await actor.click(screen.getByRole('switch', { name: /mostrar mi foto/i }));
    expect(updateWorkerProfile).toHaveBeenCalledWith({ showPhoto: false });
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: /mostrar mi foto/i })).toHaveAttribute(
        'aria-checked',
        'false',
      ),
    );
  });

  it('si no se pudo guardar, avisa y deja el valor anterior', async () => {
    updateWorkerProfile.mockRejectedValue(new Error('red'));
    const actor = await renderProfile();
    const toggle = screen.getByRole('switch', { name: /mostrar mi experiencia/i });

    await actor.click(toggle);
    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos guardar el cambio/i);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('muestra la foto propia descargada con el token aunque esté oculta', async () => {
    // jsdom no implementa URL.createObjectURL: se agrega solo para esta prueba.
    const urlApi = URL as unknown as Record<string, unknown>;
    urlApi.createObjectURL = () => 'blob:foto';
    urlApi.revokeObjectURL = () => {};
    try {
      getOwnWorkerProfile.mockResolvedValue({ ...own, showPhoto: false });
      await renderProfile();
      expect(await screen.findByRole('img', { name: 'Foto de Ana Pérez' })).toHaveAttribute(
        'src',
        'blob:foto',
      );
      expect(getOwnWorkerPhoto).toHaveBeenCalled();
    } finally {
      delete urlApi.createObjectURL;
      delete urlApi.revokeObjectURL;
    }
  });

  it('valida la foto nueva antes de subirla', async () => {
    const actor = userEvent.setup({ applyAccept: false });
    render(<MyProfile />);
    await screen.findByRole('heading', { level: 1, name: 'Ana Pérez' });

    await actor.upload(
      screen.getByLabelText(/cambiar foto/i),
      new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('La foto debe ser JPG, PNG o WebP.');
    expect(replaceWorkerPhoto).not.toHaveBeenCalled();
  });

  it('enlaza al perfil público propio', async () => {
    await renderProfile();
    expect(screen.getByRole('link', { name: /ver mi perfil público/i })).toHaveAttribute(
      'href',
      '/trabajadores/w1',
    );
  });

  it('sin perfil de trabajador ofrece crearlo', async () => {
    getCurrentUser.mockResolvedValue(user(false));
    render(<MyProfile />);
    const create = await screen.findByRole('link', { name: /crear perfil de trabajador/i });
    expect(create).toHaveAttribute('href', ROUTES.workerProfile);
    expect(getOwnWorkerProfile).not.toHaveBeenCalled();
  });

  it('sin sesión lleva a iniciar sesión', async () => {
    getCurrentUser.mockResolvedValue(null);
    render(<MyProfile />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(ROUTES.login));
  });

  it('el formulario de datos se muestra con los valores guardados (HU-032 CA1)', async () => {
    await renderProfile();
    const form = screen.getByRole('form', { name: /datos del perfil/i });
    expect(within(form).getByLabelText(/^nombre/i)).toHaveValue('Ana Pérez');
    expect(within(form).getByLabelText(/zona de cali/i)).toHaveValue('2');
  });
});
