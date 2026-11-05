export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const TOKEN_ISSUER = 'red-oportunidades';

//HU-021 CA2: el mismo mensaje sin importar si falló el correo o la contraseña

export const INVALID_CREDENTIALS = {
    code: 'INVALID_CREDENTIALS',
    message: 'Correo o contraseña incorrectos',
};

// HU-021 CA4: el frontend ofrece reenviar el enlace con POST /v1/auth/resend-confirmation.
export const EMAIL_NOT_CONFIRMED = {
    code: 'EMAIL_NOT_CONFIRMED',
    message: 'debes confirmar tu correo electrónico para iniciar sesión. Revisa tu bandeja de entrada o solicita un nuevo enlace de confirmación.',
};

export const ACCOUNT_SUSPENDED = {
    code: 'ACCOUNT_SUSPENDED',
    message: 'Tu cuenta ha sido suspendida. Por favor, contacta al soporte para más información.',
};

// HU-021 CA5: sesion vencida o cerrada, el frontend pide iniciar sesion otra vez

export const SESSION_EXPIRED = {
    code: 'SESSION_EXPIRED',
    message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
};

