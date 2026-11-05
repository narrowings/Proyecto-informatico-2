import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGAL_VERSIONS } from '@/lib/legal';
import { ROUTES } from '@/lib/routes';
import { RegisterForm } from './register-form';

const push = vi.fn();
const register = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api', () => ({ authApi: { register: (...args: unknown[]) => register(...args) } }));

const LABELS = {
  name: /^nombre/i,
  email: /correo electrónico/i,
  phone: /número de contacto/i,
  password: /^contraseña/i,
  terms: /acepto los términos y condiciones/i,
  privacy: /acepto la política de privacidad/i,
  data: /autorizo el tratamiento de mis datos personales/i,
  adult: /confirmo que soy mayor de 18 años/i,
};

async function fillFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(LABELS.name), 'Ana Pérez');
  await user.type(screen.getByLabelText(LABELS.email), 'ana@example.com');
  await user.type(screen.getByLabelText(LABELS.phone), '3001234567');
  await user.type(screen.getByLabelText(LABELS.password), 'Segura123');
}

async function checkAll(user: ReturnType<typeof userEvent.setup>) {
  for (const label of [LABELS.terms, LABELS.privacy, LABELS.data, LABELS.adult]) {
    await user.click(screen.getByLabelText(label));
  }
}

const submitButton = () => screen.getByRole('button', { name: /crear cuenta/i });

beforeEach(() => {
  push.mockReset();
  register.mockReset();
});

describe('RegisterForm', () => {
  it('con las casillas sin marcar el botón queda deshabilitado (HU-017 CA1)', () => {
    render(<RegisterForm />);
    expect(submitButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('al intentar enviar marca en rojo las casillas faltantes y no crea la cuenta (HU-017 CA1)', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillFields(user);
    await user.click(submitButton());

    expect(
      await screen.findByText(/debes aceptar los términos y condiciones/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(LABELS.terms)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(LABELS.privacy)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(LABELS.data)).toHaveAttribute('aria-invalid', 'true');
    expect(register).not.toHaveBeenCalled();
  });

  it('sin confirmar mayoría de edad no crea la cuenta y explica que es solo para adultos (HU-017 CA3)', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillFields(user);
    for (const label of [LABELS.terms, LABELS.privacy, LABELS.data]) {
      await user.click(screen.getByLabelText(label));
    }
    await user.click(submitButton());

    expect(await screen.findByText(/solo para mayores de 18 años/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('muestra un error junto a cada campo vacío (HU-001 CA4)', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.click(submitButton());

    expect(await screen.findByText('Ingresa tu nombre.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu correo electrónico.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu número de contacto.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa una contraseña.')).toBeInTheDocument();
    expect(screen.getByLabelText(LABELS.name)).toHaveAttribute('aria-invalid', 'true');
    expect(register).not.toHaveBeenCalled();
  });

  it('rechaza un correo inválido y una contraseña débil (HU-001 CA4)', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText(LABELS.email), 'correo-malo');
    await user.type(screen.getByLabelText(LABELS.password), 'debil');
    await user.click(submitButton());

    expect(await screen.findByText('Ingresa un correo electrónico válido.')).toBeInTheDocument();
    expect(screen.getByText(/la contraseña no cumple la política/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('con datos válidos envía el registro con las versiones de los documentos y va a cuenta pendiente (HU-001 CA1, HU-017 CA2)', async () => {
    register.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillFields(user);
    await checkAll(user);
    await user.click(submitButton());

    await waitFor(() => expect(push).toHaveBeenCalledWith(ROUTES.registerPending));
    expect(register).toHaveBeenCalledWith({
      name: 'Ana Pérez',
      email: 'ana@example.com',
      phone: '3001234567',
      password: 'Segura123',
      consents: { ...LEGAL_VERSIONS, isAdult: true },
    });
  });

  it('si el correo ya existe se detiene y muestra el mensaje con enlace a iniciar sesión (HU-001 CA3)', async () => {
    register.mockResolvedValue({ ok: false, reason: 'email_taken' });
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillFields(user);
    await checkAll(user);
    await user.click(submitButton());

    const link = await screen.findByRole('link', { name: /inicia sesión/i });
    expect(link).toHaveAttribute('href', ROUTES.login);
    expect(screen.getByText(/este correo ya está registrado\. por favor,/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('enlaza los textos completos de los documentos legales (HU-017)', () => {
    render(<RegisterForm />);
    expect(screen.getByRole('link', { name: /términos y condiciones/i })).toHaveAttribute(
      'href',
      ROUTES.terms,
    );
    expect(screen.getByRole('link', { name: /política de privacidad/i })).toHaveAttribute(
      'href',
      ROUTES.privacy,
    );
    expect(
      screen.getByRole('link', { name: /tratamiento de mis datos personales/i }),
    ).toHaveAttribute('href', ROUTES.dataProcessing);
  });
});
