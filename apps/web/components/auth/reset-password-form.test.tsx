import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PASSWORD_RESET_REASON } from '@/lib/auth/session';
import { ROUTES } from '@/lib/routes';
import { ResetPasswordForm } from './reset-password-form';

const replace = vi.fn();
const resetPassword = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api', () => ({
  authApi: { resetPassword: (...args: unknown[]) => resetPassword(...args) },
}));

async function fill(password: string, confirmation = password) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^contraseña nueva/i), password);
  await user.type(screen.getByLabelText(/confirma la contraseña nueva/i), confirmation);
  await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }));
}

beforeEach(() => {
  replace.mockReset();
  resetPassword.mockReset();
});

describe('ResetPasswordForm', () => {
  it('cambia la contraseña y lleva a iniciar sesión (HU-018 CA2)', async () => {
    resetPassword.mockResolvedValue({ status: 'ok' });
    render(<ResetPasswordForm token="tok-123" />);
    await fill('Nueva1234');

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`${ROUTES.login}?motivo=${PASSWORD_RESET_REASON}`),
    );
    expect(resetPassword).toHaveBeenCalledWith({
      token: 'tok-123',
      password: 'Nueva1234',
      passwordConfirmation: 'Nueva1234',
    });
  });

  it('no envía si la contraseña no cumple la política o no coincide (HU-018 CA4)', async () => {
    render(<ResetPasswordForm token="tok-123" />);
    await fill('corta', 'otra');

    expect(await screen.findByText(/no cumple la política/i)).toBeInTheDocument();
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('con el enlace vencido o usado ofrece pedir uno nuevo (HU-018 CA3)', async () => {
    resetPassword.mockResolvedValue({ status: 'expired' });
    render(<ResetPasswordForm token="tok-viejo" />);
    await fill('Nueva1234');

    expect(await screen.findByRole('heading', { name: /ya no es válido/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pedir un enlace nuevo/i })).toHaveAttribute(
      'href',
      ROUTES.forgotPassword,
    );
  });

  it('sin token muestra directamente el enlace inválido', () => {
    render(<ResetPasswordForm token="" />);
    expect(screen.getByRole('heading', { name: /ya no es válido/i })).toBeInTheDocument();
  });

  it('muestra bajo cada campo los errores que devuelve el API', async () => {
    resetPassword.mockResolvedValue({
      status: 'invalid',
      errors: { password: ['La contraseña debe tener entre 8 y 128 caracteres'] },
    });
    render(<ResetPasswordForm token="tok-123" />);
    await fill('Nueva1234');

    expect(
      await screen.findByText('La contraseña debe tener entre 8 y 128 caracteres'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña nueva/i)).toHaveAttribute('aria-invalid', 'true');
  });
});
