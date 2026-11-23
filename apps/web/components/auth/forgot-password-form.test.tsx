import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordForm, GENERIC_SENT_MESSAGE } from './forgot-password-form';

const forgotPassword = vi.fn();
vi.mock('@/lib/api', () => ({
  authApi: { forgotPassword: (...args: unknown[]) => forgotPassword(...args) },
}));

const submit = () => screen.getByRole('button', { name: /enviar enlace/i });

beforeEach(() => forgotPassword.mockReset());

describe('ForgotPasswordForm', () => {
  it('muestra el mismo mensaje genérico exista o no el correo (HU-018 CA1)', async () => {
    forgotPassword.mockResolvedValue({ status: 'sent' });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/correo electrónico/i), '  ana@example.com ');
    await user.click(submit());

    expect(await screen.findByRole('status')).toHaveTextContent(GENERIC_SENT_MESSAGE);
    expect(screen.getByRole('status')).toHaveTextContent(/30 minutos/);
    expect(forgotPassword).toHaveBeenCalledWith('ana@example.com');
  });

  it('valida el correo antes de enviar', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText(/correo electrónico/i), 'no-es-correo');
    await user.click(submit());

    expect(await screen.findByText('Ingresa un correo electrónico válido.')).toBeInTheDocument();
    expect(forgotPassword).not.toHaveBeenCalled();
  });

  it('con demasiados intentos dice cuánto esperar (429)', async () => {
    forgotPassword.mockResolvedValue({ status: 'rate_limited', retryAfterMinutes: 12 });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText(/correo electrónico/i), 'ana@example.com');
    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent('Inténtalo de nuevo en 12 minutos');
  });
});
