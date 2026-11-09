/** Parámetro de la URL de inicio de sesión cuando la sesión se cerró por inactividad. */
export const SESSION_EXPIRED_REASON = 'sesion-expirada';

/**
 * El SRS (RNF-SEG-05) fija 7 días de inactividad para usuarios; las HU no lo
 * definen. Es configurable con NEXT_PUBLIC_SESSION_INACTIVITY_MINUTES.
 */
const DEFAULT_INACTIVITY_MINUTES = 7 * 24 * 60;

/** setTimeout no admite más de 2^31 - 1 ms (unos 24,8 días). */
const MAX_TIMER_MS = 2_147_483_647;

export function getInactivityTimeoutMs(): number {
  const minutes = Number(process.env.NEXT_PUBLIC_SESSION_INACTIVITY_MINUTES);
  const valid = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_INACTIVITY_MINUTES;
  return Math.min(valid * 60_000, MAX_TIMER_MS);
}
