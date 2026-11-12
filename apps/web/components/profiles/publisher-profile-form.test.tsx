import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublisherProfileForm } from './publisher-profile-form';

const replace = vi.fn();
const getCurrentUser = vi.fn();
const uploadProfilePhoto = vi.fn();
const createPublisherProfile = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api', () => ({
  sessionApi: { getCurrentUser: () => getCurrentUser() },
  profilesApi: {
    uploadProfilePhoto: (...args: unknown[]) => uploadProfilePhoto(...args),
    createPublisherProfile: (...args: unknown[]) => createPublisherProfile(...args),
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({
    id: 'u1',
    name: 'Ana Pérez',
    hasWorkerProfile: true,
    hasPublisherProfile: false,
  });
  uploadProfilePhoto.mockResolvedValue({ url: '/foto.png' });
  createPublisherProfile.mockResolvedValue({ ok: true, profile: { id: 'p1' } });
});

async function prepare(company = false) {
  const user = userEvent.setup();
  render(<PublisherProfileForm />);
  await screen.findByLabelText('Tipo de perfil');
  if (company) await user.selectOptions(screen.getByLabelText('Tipo de perfil'), 'COMPANY');
  await user.upload(
    screen.getByLabelText(company ? 'Subir logo' : 'Subir foto'),
    new File(['foto'], 'foto.png', { type: 'image/png' }),
  );
  await user.type(screen.getByLabelText('Descripción'), 'Servicios en Cali');
  return user;
}

describe('HU-008 formulario', () => {
  it('crea persona natural y enlaza su perfil público (CA1)', async () => {
    const user = await prepare();
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    expect(await screen.findByRole('link', { name: 'Ver perfil público' })).toHaveAttribute(
      'href',
      '/publicadores/p1',
    );
    expect(createPublisherProfile).toHaveBeenCalledWith({
      kind: 'PERSON',
      displayName: 'Ana Pérez',
      description: 'Servicios en Cali',
      photoUrl: '/foto.png',
    });
    expect(screen.getByRole('link', { name: 'Continuar para publicar' })).toHaveAttribute(
      'href',
      '/publicar',
    );
  });
  it('crea empresa con NIT válido y representante (CA2)', async () => {
    const user = await prepare(true);
    await user.type(screen.getByLabelText('NIT'), '800197268');
    await user.type(screen.getByLabelText('Dígito de verificación'), '4');
    await user.type(screen.getByLabelText('Contacto o representante'), 'Contacto privado');
    await user.type(screen.getByLabelText('Sector'), 'Servicios');
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    await screen.findByRole('link', { name: 'Ver perfil público' });
    expect(createPublisherProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'COMPANY',
        nit: '800197268',
        nitCheckDigit: '4',
        contactName: 'Contacto privado',
        sector: 'Servicios',
      }),
    );
  });
  it('marca campos incompletos y enfoca el primer error', async () => {
    const user = userEvent.setup();
    render(<PublisherProfileForm />);
    await screen.findByLabelText('Tipo de perfil');
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    await waitFor(() => expect(screen.getByLabelText('Subir foto')).toHaveFocus());
    expect(createPublisherProfile).not.toHaveBeenCalled();
  });
  it('conserva los datos y permite reintentar tras un error', async () => {
    createPublisherProfile.mockRejectedValueOnce(new Error('red'));
    const user = await prepare();
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar');
    expect(screen.getByLabelText('Descripción')).toHaveValue('Servicios en Cali');
    await user.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    await screen.findByRole('link', { name: 'Ver perfil público' });
  });
  it('redirige al inicio de sesión si no hay usuario', async () => {
    getCurrentUser.mockResolvedValue(null);
    render(<PublisherProfileForm />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/iniciar-sesion'));
  });
});
