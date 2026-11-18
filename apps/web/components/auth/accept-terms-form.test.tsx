import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROUTES } from '@/lib/routes';
import { AcceptTermsForm } from './accept-terms-form';

const documents = {
  terms: { version: '0.1', url: '/legal/terminos' },
  privacy: { version: '0.1', url: '/legal/privacidad' },
  dataProcessing: { version: '0.1', url: '/legal/tratamiento-de-datos' },
};
const replace = vi.fn();
const acceptTerms = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api', () => ({
  authApi: {
    currentDocuments: async () => documents,
    acceptTerms: (...args: unknown[]) => acceptTerms(...args),
  },
}));

const button = () => screen.getByRole('button', { name: /aceptar y continuar/i });

beforeEach(() => {
  replace.mockReset();
  acceptTerms.mockReset();
});

describe('AcceptTermsForm', () => {
  it('no deja continuar hasta aceptar los tres documentos (HU-017 CA4)', async () => {
    const user = userEvent.setup();
    render(<AcceptTermsForm />);
    expect(button()).toHaveAttribute('aria-disabled', 'true');

    await user.click(button());
    expect(
      await screen.findByText(/debes aceptar los términos y condiciones/i),
    ).toBeInTheDocument();
    expect(acceptTerms).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('registra la aceptación con la versión de cada documento y continúa (HU-017 CA4)', async () => {
    acceptTerms.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AcceptTermsForm />);
    for (const label of [
      /acepto los términos y condiciones/i,
      /acepto la política de privacidad/i,
      /autorizo el tratamiento de mis datos personales/i,
    ]) {
      await user.click(screen.getByLabelText(label));
    }
    await user.click(button());

    await waitFor(() => expect(replace).toHaveBeenCalledWith(ROUTES.home));
    expect(acceptTerms).toHaveBeenCalledWith({
      terms: '0.1',
      privacy: '0.1',
      dataProcessing: '0.1',
    });
  });
});
