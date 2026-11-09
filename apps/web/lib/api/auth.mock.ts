import type { AuthApi } from './auth';

const wait = (ms = 400) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/** Contraseña válida para todas las cuentas de prueba. */
const MOCK_PASSWORD = 'Segura123';

const mockAccounts = new Map<string, 'active' | 'new-terms' | 'unconfirmed'>([
  ['ana@example.com', 'active'],
  ['nuevos-terminos@example.com', 'new-terms'],
  ['sin-confirmar@example.com', 'unconfirmed'],
]);

/** Intentos fallidos consecutivos por correo (solo en memoria, se pierde al recargar). */
const failedAttempts = new Map<string, number>();

/**
 * API simulada mientras no exista el backend de identidad.
 *
 * Registro:
 * - `ya@registrado.com` responde "correo ya registrado".
 *
 * Confirmación de correo:
 * - el token `vencido` (o sin token) responde "enlace vencido".
 *
 * Inicio de sesión (contraseña `Segura123`):
 * - `ana@example.com`: cuenta activa.
 * - `nuevos-terminos@example.com`: activa, con nuevos términos por aceptar.
 * - `sin-confirmar@example.com`: cuenta sin confirmar.
 * - cualquier otro correo o contraseña: credenciales incorrectas; al 5.º fallo
 *   consecutivo con el mismo correo responde bloqueo de 15 minutos.
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

  async login({ email, password }) {
    await wait();
    const key = email.trim().toLowerCase();
    const locked = { status: 'locked', retryAfterMinutes: LOCK_MINUTES } as const;

    if ((failedAttempts.get(key) ?? 0) >= MAX_FAILED_ATTEMPTS) return locked;

    const account = mockAccounts.get(key);
    if (!account || password !== MOCK_PASSWORD) {
      const attempts = (failedAttempts.get(key) ?? 0) + 1;
      failedAttempts.set(key, attempts);
      return attempts >= MAX_FAILED_ATTEMPTS ? locked : { status: 'invalid_credentials' };
    }

    failedAttempts.delete(key);
    if (account === 'unconfirmed') return { status: 'unconfirmed' };
    return { status: 'ok', requiresTermsAcceptance: account === 'new-terms' };
  },

  async resendConfirmationLink() {
    await wait();
  },

  async logout() {
    await wait(150);
  },

  async acceptTerms() {
    await wait();
  },
};
