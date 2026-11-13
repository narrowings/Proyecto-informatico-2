import type { CookieOptions, Response } from 'express';
import { REFRESH_TTL_MS } from './session.constants';

export const REFRESH_COOKIE = 'refresh_token';

// Secure en todo ambiente salvo desarrollo local: QA y producción van por HTTPS (revisión PR #5, 3.3).
// Si NODE_ENV no está definido también es Secure, para que un olvido no la mande en claro.
export const isSecureCookie = (nodeEnv: string | undefined) => nodeEnv !== 'development';

// httpOnly: el JavaScript del navegador no puede leerla. Path limitado a las rutas de autenticación.
const base = (secure: boolean): CookieOptions => ({
  httpOnly: true,
  secure,
  sameSite: 'lax',
  path: '/v1/auth',
});

export const setRefreshCookie = (response: Response, token: string, secure: boolean) =>
  response.cookie(REFRESH_COOKIE, token, { ...base(secure), maxAge: REFRESH_TTL_MS });

export const clearRefreshCookie = (response: Response, secure: boolean) =>
  response.clearCookie(REFRESH_COOKIE, base(secure));

export const readCookie = (header: string | undefined, name: string): string | undefined => {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key !== name) continue;
    try {
      return decodeURIComponent(value.join('='));
    } catch {
      return undefined;
    }
  }
  return undefined;
};