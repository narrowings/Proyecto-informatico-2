import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@/lib/routes';
import { LogoutButton } from './logout-button';

const replace = vi.fn();
const logout = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api', () => ({ authApi: { logout: (...args: unknown[]) => logout(...args) } }));

beforeEach(() => {
  replace.mockReset();
  logout.mockReset();
});

describe('LogoutButton', () => {
  it('cierra la sesión y pide iniciar sesión de nuevo (HU-021 CA5)', async () => {
    logout.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LogoutButton />);
    await user.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith(ROUTES.login));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('si falla el cierre informa el problema y no redirige', async () => {
    logout.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(<LogoutButton />);
    await user.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos cerrar tu sesión/i);
    expect(replace).not.toHaveBeenCalled();
  });
});
