import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@/lib/routes';
import { WorkerProfileForm } from './worker-profile-form';

const replace = vi.fn();
const getCurrentUser = vi.fn();
const uploadProfilePhoto = vi.fn();
const createWorkerProfile = vi.fn();

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
      { id: 6, name: 'Edición de video y fotografía' },
    ],
  },
  profilesApi: {
    uploadProfilePhoto: (...args: unknown[]) => uploadProfilePhoto(...args),
    createWorkerProfile: (...args: unknown[]) => createWorkerProfile(...args),
  },
}));

const ana = { id: 'u1', name: 'Ana Pérez', hasWorkerProfile: false, hasPublisherProfile: false };
const foto = () => new File(['foto'], 'ana.png', { type: 'image/png' });
const submit = () => screen.getByRole('button', { name: /guardar perfil/i });

async function renderForm(props?: { fromWork?: boolean }) {
  const user = userEvent.setup();
  render(<WorkerProfileForm {...props} />);
  await screen.findByRole('heading', { name: /crea tu perfil de trabajador/i });
  return user;
}

beforeEach(() => {
  replace.mockReset();
  getCurrentUser.mockReset().mockResolvedValue(ana);
  uploadProfilePhoto.mockReset().mockResolvedValue({ url: 'https://media.test/ana.png' });
  createWorkerProfile.mockReset();
});

describe('WorkerProfileForm', () => {
  it('trae el nombre de la cuenta', async () => {
    await renderForm();
    expect(screen.getByLabelText(/^nombre/i)).toHaveValue('Ana Pérez');
  });

  it('sin habilidad, categoría ni zona no guarda y señala los campos (HU-002 CA2)', async () => {
    const user = await renderForm();
    await user.upload(screen.getByLabelText(/subir foto/i), foto());
    await user.click(submit());

    expect(await screen.findByText('Agrega al menos una habilidad.')).toBeInTheDocument();
    expect(screen.getByText('Elige al menos una categoría de interés.')).toBeInTheDocument();
    expect(screen.getByText('Elige tu zona de Cali.')).toBeInTheDocument();
    expect(screen.getByLabelText('Habilidades')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/zona de cali/i)).toHaveAttribute('aria-invalid', 'true');
    expect(createWorkerProfile).not.toHaveBeenCalled();
  });

  it('exige la foto de perfil y lleva el foco al primer campo con error', async () => {
    const user = await renderForm();
    await user.click(submit());
    expect(await screen.findByText('Agrega una foto de perfil.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/subir foto/i)).toHaveFocus());
  });

  it('guarda el perfil y queda "Disponible" (HU-002 CA1)', async () => {
    createWorkerProfile.mockResolvedValue({
      ok: true,
      profile: { id: 'p1', availability: 'AVAILABLE' },
    });
    const user = await renderForm();

    await user.upload(screen.getByLabelText(/subir foto/i), foto());
    await user.type(screen.getByLabelText('Habilidades'), 'Logística{Enter}');
    await user.type(screen.getByLabelText('Habilidades'), 'edición de video,');
    await user.type(screen.getByLabelText(/experiencia/i), 'Dos años en trasteos.');
    await user.click(screen.getByLabelText('Trasteos y logística'));
    await user.selectOptions(screen.getByLabelText(/zona de cali/i), 'Sur');
    await user.click(submit());

    expect(await screen.findByRole('status')).toHaveTextContent('Estado: Disponible');
    expect(uploadProfilePhoto).toHaveBeenCalledWith(expect.objectContaining({ name: 'ana.png' }));
    expect(createWorkerProfile).toHaveBeenCalledWith({
      displayName: 'Ana Pérez',
      photoUrl: 'https://media.test/ana.png',
      skills: ['Logística', 'edición de video'],
      experience: 'Dos años en trasteos.',
      zoneId: 2,
      categoryIds: [1],
    });
    expect(screen.getByRole('link', { name: /ver oportunidades/i })).toHaveAttribute(
      'href',
      ROUTES.work,
    );
  });

  it('permite quitar una habilidad', async () => {
    const user = await renderForm();
    await user.type(screen.getByLabelText('Habilidades'), 'Logística{Enter}');
    await user.click(screen.getByRole('button', { name: 'Quitar Logística' }));
    expect(screen.queryByRole('list', { name: /habilidades agregadas/i })).not.toBeInTheDocument();
  });

  it('agrega varias habilidades pegadas con comas', async () => {
    const user = await renderForm();
    await user.click(screen.getByLabelText('Habilidades'));
    await user.paste('Pintura, Plomería, Jardinería');

    const added = screen.getByRole('list', { name: /habilidades agregadas/i });
    expect(added).toHaveTextContent('Pintura');
    expect(added).toHaveTextContent('Plomería');
    expect(screen.getByLabelText('Habilidades')).toHaveValue(' Jardinería');
  });

  it('no pierde lo escrito sin Enter al pasar a otro campo', async () => {
    const user = await renderForm();
    await user.type(screen.getByLabelText('Habilidades'), 'Cocina');
    await user.click(screen.getByLabelText(/experiencia/i));

    expect(screen.getByRole('list', { name: /habilidades agregadas/i })).toHaveTextContent(
      'Cocina',
    );
    expect(screen.getByLabelText('Habilidades')).toHaveValue('');
  });

  it('explica por qué llegó aquí cuando viene de "Quiero trabajar" (HU-022 CA3)', async () => {
    await renderForm({ fromWork: true });
    expect(screen.getByText(/primero completa tu perfil de trabajador/i)).toBeInTheDocument();
  });

  it('avisa si no pudo guardar', async () => {
    createWorkerProfile.mockRejectedValue(new Error('red'));
    const user = await renderForm();
    await user.upload(screen.getByLabelText(/subir foto/i), foto());
    await user.type(screen.getByLabelText('Habilidades'), 'Logística{Enter}');
    await user.click(screen.getByLabelText('Trasteos y logística'));
    await user.selectOptions(screen.getByLabelText(/zona de cali/i), 'Norte');
    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos guardar tu perfil/i);
  });

  it('sin sesión redirige a iniciar sesión', async () => {
    getCurrentUser.mockResolvedValue(null);
    render(<WorkerProfileForm />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(ROUTES.login));
  });
});
