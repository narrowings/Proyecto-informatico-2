import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublisherPublicProfile } from './publisher-public-profile';

const getPublicPublisherProfile = vi.fn();
vi.mock('@/lib/api', () => ({
  profilesApi: {
    getPublicPublisherProfile: (...args: unknown[]) => getPublicPublisherProfile(...args),
  },
}));

beforeEach(() => {
  getPublicPublisherProfile.mockReset().mockResolvedValue({
    id: 'p1',
    kind: 'COMPANY',
    displayName: 'Empresa Cali',
    photoUrl: '/logo.png',
    description: 'Servicios locales',
    isVerified: false,
    contactName: 'Contacto privado',
    nit: '800197268',
    email: 'privado@example.com',
  });
});

describe('HU-008 perfil público CA3', () => {
  it('muestra información pública sin datos de contacto ni insignia inventada', async () => {
    render(<PublisherPublicProfile id="p1" />);
    await screen.findByRole('heading', { name: 'Empresa Cali' });
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'Logo de Empresa Cali');
    expect(screen.getByText('Servicios locales')).toBeInTheDocument();
    expect(screen.queryByText('Identidad verificada')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Contacto privado|800197268|privado@example/);
  });
  it('maneja un perfil inexistente', async () => {
    getPublicPublisherProfile.mockResolvedValue(null);
    render(<PublisherPublicProfile id="otro" />);
    expect(
      await screen.findByRole('heading', { name: 'Perfil no encontrado' }),
    ).toBeInTheDocument();
  });
  it('informa errores de carga', async () => {
    getPublicPublisherProfile.mockRejectedValue(new Error('red'));
    render(<PublisherPublicProfile id="p1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar');
  });
});
