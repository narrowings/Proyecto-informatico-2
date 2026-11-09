import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@/lib/routes';
import { LoginForm } from './login-form';

const replace = vi.fn();
const login = vi.fn();
const resendConfirmationLink = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api', () => ({
  authApi: {
    login: (...args: unknown[]) => login(...args),
    resendConfirmationLink: (...args: unknown[]) => resendConfirmationLink(...args),
  },
}));

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/correo electrónico/i), 'ana@example.com');
  await user.type(screen.getByLabelText(/^contraseña/i), 'Segura123');
  await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
}

beforeEach(() => {
  replace.mockReset();
  login.mockReset();
  resendConfirmationLink.mockReset();
});

describe('LoginForm', () => {
  it('con credenciales correctas y cuenta activa entra a la selección de intención (HU-021 CA1)', async () => {
    login.mockResolvedValue({ status: 'ok', requiresTermsAcceptance: false });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillAndSubmit(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(ROUTES.home));
    expect(login).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'Segura123' });
  });

  it('si hay nuevos términos por aceptar, los pide antes de continuar (HU-017 CA4)', async () => {
    login.mockResolvedValue({ status: 'ok', requiresTermsAcceptance: true });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillAndSubmit(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(ROUTES.acceptTerms));
  });

  it('con credenciales incorrectas muestra un mensaje genérico sin indicar qué falló (HU-021 CA2)', async () => {
    login.mockResolvedValue({ status: 'invalid_credentials' });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
    expect(screen.getByLabelText(/correo electrónico/i)).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText(/^contraseña/i)).not.toHaveAttribute('aria-invalid');
    expect(replace).not.toHaveBeenCalled();
  });

  it('tras el bloqueo por intentos fallidos informa los 15 minutos (HU-021 CA3)', async () => {
    login.mockResolvedValue({ status: 'locked', retryAfterMinutes: 15 });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /bloqueamos el ingreso durante 15 minutos/i,
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('con cuenta sin confirmar indica que debe confirmar el correo y permite reenviar el enlace (HU-021 CA4)', async () => {
    login.mockResolvedValue({ status: 'unconfirmed' });
    resendConfirmationLink.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillAndSubmit(user);

    expect(await screen.findByText(/debes confirmar tu correo electrónico/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /reenviar enlace de confirmación/i }));
    expect(await screen.findByText(/te enviamos un nuevo enlace/i)).toBeInTheDocument();
    expect(resendConfirmationLink).toHaveBeenCalledWith('ana@example.com');
  });

  it('muestra un error junto a cada campo vacío y no consulta la API', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText('Ingresa tu correo electrónico.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('avisa cuando se llegó por una sesión cerrada por inactividad (HU-021 CA5)', () => {
    render(<LoginForm sessionExpired />);
    expect(screen.getByRole('status')).toHaveTextContent(/se cerró por inactividad/i);
  });

  it('no muestra el aviso de inactividad en un ingreso normal', () => {
    render(<LoginForm />);
    expect(screen.queryByText(/inactividad/i)).not.toBeInTheDocument();
  });

  it('ofrece crear una cuenta', () => {
    render(<LoginForm />);
    expect(screen.getByRole('link', { name: /crea una/i })).toHaveAttribute(
      'href',
      ROUTES.register,
    );
  });
});
