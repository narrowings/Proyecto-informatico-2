import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@/lib/routes';
import { IntentScreen } from './intent-screen';

const replace = vi.fn();
const getCurrentUser = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api', () => ({ sessionApi: { getCurrentUser: () => getCurrentUser() } }));

const ana = { id: 'u1', name: 'Ana Pérez', hasWorkerProfile: false, hasPublisherProfile: false };

beforeEach(() => {
  replace.mockReset();
  getCurrentUser.mockReset();
});

describe('IntentScreen', () => {
  it('muestra las tres intenciones con su destino (HU-022 CA1)', async () => {
    getCurrentUser.mockResolvedValue(ana);
    render(<IntentScreen />);

    expect(await screen.findByText(/hola, ana/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /quiero trabajar/i })).toHaveAttribute(
      'href',
      ROUTES.work,
    );
    expect(screen.getByRole('link', { name: /necesito ayuda/i })).toHaveAttribute(
      'href',
      ROUTES.publish,
    );
    expect(screen.getByRole('link', { name: /mi actividad/i })).toHaveAttribute(
      'href',
      ROUTES.activity,
    );
  });

  it('sin sesión redirige a iniciar sesión', async () => {
    getCurrentUser.mockResolvedValue(null);
    render(<IntentScreen />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(ROUTES.login));
  });

  it('avisa si no pudo cargar la sesión', async () => {
    getCurrentUser.mockRejectedValue(new Error('red'));
    render(<IntentScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos cargar tu sesión/i);
  });
});
