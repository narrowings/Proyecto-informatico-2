import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@/lib/routes';
import { redirectFor, RequireProfile } from './require-profile';

const replace = vi.fn();
const getCurrentUser = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api', () => ({ sessionApi: { getCurrentUser: () => getCurrentUser() } }));

const user = (hasWorkerProfile: boolean, hasPublisherProfile: boolean) => ({
  id: 'u1',
  name: 'Ana Pérez',
  hasWorkerProfile,
  hasPublisherProfile,
});

beforeEach(() => {
  replace.mockReset();
  getCurrentUser.mockReset();
});

describe('redirectFor', () => {
  it('sin sesión manda a iniciar sesión', () => {
    expect(redirectFor(null, 'none')).toBe(ROUTES.login);
  });

  it('la primera vez manda a completar el perfil correspondiente (HU-022 CA3)', () => {
    expect(redirectFor(user(false, false), 'worker')).toBe(
      `${ROUTES.workerProfile}?desde=trabajar`,
    );
    expect(redirectFor(user(false, false), 'publisher')).toBe(ROUTES.publisherProfile);
  });

  it('una cuenta con ambos perfiles entra a las dos intenciones (HU-022 CA4)', () => {
    expect(redirectFor(user(true, true), 'worker')).toBeNull();
    expect(redirectFor(user(true, true), 'publisher')).toBeNull();
  });

  it('"Mi actividad" solo exige sesión', () => {
    expect(redirectFor(user(false, false), 'none')).toBeNull();
  });
});

describe('RequireProfile', () => {
  it('sin perfil de trabajador redirige y no muestra el contenido (HU-022 CA3)', async () => {
    getCurrentUser.mockResolvedValue(user(false, true));
    render(<RequireProfile profile="worker">Oportunidades</RequireProfile>);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`${ROUTES.workerProfile}?desde=trabajar`),
    );
    expect(screen.queryByText('Oportunidades')).not.toBeInTheDocument();
  });

  it('con el perfil muestra el contenido', async () => {
    getCurrentUser.mockResolvedValue(user(true, false));
    render(<RequireProfile profile="worker">Oportunidades</RequireProfile>);

    expect(await screen.findByText('Oportunidades')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
