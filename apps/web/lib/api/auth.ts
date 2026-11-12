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

export type AuthApi = {
  register(request: RegisterRequest): Promise<RegisterResult>;
  confirmEmail(token: string): Promise<ConfirmEmailResult>;
  /** El token vencido identifica la cuenta a la que se reenvía el enlace. */
  requestNewConfirmationLink(token: string): Promise<void>;
};
