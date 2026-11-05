import type { AuthApi } from './auth';

const wait = (ms = 400) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * API simulada mientras no exista el backend de identidad.
 * - Registro con `ya@registrado.com` responde "correo ya registrado".
 * - Confirmar con el token `vencido` (o sin token) responde "enlace vencido".
 */
export const mockAuthApi: AuthApi = {
  async register({ email }) {
    await wait();
    return email.toLowerCase() === 'ya@registrado.com'
      ? { ok: false, reason: 'email_taken' }
      : { ok: true };
  },

  async confirmEmail(token) {
    await wait();
    return token && token !== 'vencido' ? { status: 'active' } : { status: 'expired' };
  },

  async requestNewConfirmationLink() {
    await wait();
  },
};
