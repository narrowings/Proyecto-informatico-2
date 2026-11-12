/**
 * Contrato que el frontend espera de la API de identidad. Es provisional: debe
 * reemplazarse por el cliente generado de @red/contracts cuando exista el
 * contrato OpenAPI de registro y confirmación.
 */

export type RegisterRequest = {
  name: string;
  email: string;
  phone: string;
  password: string;
  /** Versión de cada documento aceptado (HU-017). La fecha y la hora las pone el servidor. */
  consents: {
    terms: string;
    privacy: string;
    dataProcessing: string;
    isAdult: true;
  };
};

export type RegisterResult = { ok: true } | { ok: false; reason: 'email_taken' };

export type ConfirmEmailResult = { status: 'active' } | { status: 'expired' };

export type LoginRequest = { email: string; password: string };

export type LoginResult =
  | {
      status: 'ok';
      /** Hay una nueva versión de términos o política sin aceptar (HU-017 CA4). */
      requiresTermsAcceptance: boolean;
    }
  /** Credenciales incorrectas; no se indica cuál falló (HU-021 CA2). */
  | { status: 'invalid_credentials' }
  /** Bloqueo temporal tras 5 intentos fallidos consecutivos (HU-021 CA3). */
  | { status: 'locked'; retryAfterMinutes: number }
  /** La cuenta existe pero el correo no está confirmado (HU-021 CA4). */
  | { status: 'unconfirmed' };

/** Versión de cada documento legal que el usuario acepta (HU-017). */
export type LegalConsents = Omit<RegisterRequest['consents'], 'isAdult'>;

export type AuthApi = {
  register(request: RegisterRequest): Promise<RegisterResult>;
  confirmEmail(token: string): Promise<ConfirmEmailResult>;
  /** El token vencido identifica la cuenta a la que se reenvía el enlace. */
  requestNewConfirmationLink(token: string): Promise<void>;
  login(request: LoginRequest): Promise<LoginResult>;
  /** Reenvía el enlace de confirmación a una cuenta sin confirmar (HU-021 CA4). */
  resendConfirmationLink(email: string): Promise<void>;
  /** Cierra la sesión en el servidor (HU-021 CA5). */
  logout(): Promise<void>;
  /** Registra la aceptación de las nuevas versiones de los documentos (HU-017 CA4). */
  acceptTerms(consents: LegalConsents): Promise<void>;
};
