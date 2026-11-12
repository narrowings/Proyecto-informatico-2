import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@/lib/routes';
import { ConfirmEmail } from './confirm-email';

const replace = vi.fn();
const confirmEmail = vi.fn();
const requestNewConfirmationLink = vi.fn();
let token = 'abc123';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(token ? { token } : {}),
}));
vi.mock('@/lib/api', () => ({
  authApi: {
    confirmEmail: (...args: unknown[]) => confirmEmail(...args),
    requestNewConfirmationLink: (...args: unknown[]) => requestNewConfirmationLink(...args),
  },
}));

beforeEach(() => {
  replace.mockReset();
  confirmEmail.mockReset();
  requestNewConfirmationLink.mockReset();
  token = 'abc123';
});

describe('ConfirmEmail', () => {
  it('con el enlace válido activa la cuenta y redirige al Inicio (HU-001 CA2)', async () => {
    confirmEmail.mockResolvedValue({ status: 'active' });
    render(<ConfirmEmail />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(ROUTES.home));
    expect(confirmEmail).toHaveBeenCalledWith('abc123');
  });

  it('con el enlace vencido permite solicitar uno nuevo (HU-001 CA2)', async () => {
    confirmEmail.mockResolvedValue({ status: 'expired' });
    requestNewConfirmationLink.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ConfirmEmail />);

    expect(await screen.findByRole('heading', { name: /el enlace venció/i })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /solicitar nuevo enlace/i }));
    expect(await screen.findByText(/te enviamos un nuevo enlace/i)).toBeInTheDocument();
    expect(requestNewConfirmationLink).toHaveBeenCalledWith('abc123');
  });

  it('si falla la confirmación informa el problema', async () => {
    confirmEmail.mockRejectedValue(new Error('boom'));
    render(<ConfirmEmail />);

    expect(
      await screen.findByRole('heading', { name: /no pudimos confirmar tu correo/i }),
    ).toBeInTheDocument();
  });
});
