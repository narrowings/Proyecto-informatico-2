/**
 * Formatos de la interfaz (RNF-USA-07): español de Colombia y hora de
 * America/Bogota. El API envía las fechas en UTC (ISO 8601).
 */

const TIME_ZONE = 'America/Bogota';

const rating = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const shortDate = new Intl.DateTimeFormat('es-CO', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Montos en pesos colombianos enteros, sin decimales: `$ 150.000`. */
export function formatCop(amount: number): string {
  return `$ ${Math.trunc(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** "Intenta de nuevo en 3 minutos" a partir de `retryAfter` (segundos) de un 429. */
export function waitMessage(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Inténtalo de nuevo más tarde.';
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1
    ? 'Inténtalo de nuevo en 1 minuto.'
    : `Inténtalo de nuevo en ${minutes} minutos.`;
}

/** 4.8 → "4,8" */
export function formatRating(value: number): string {
  return rating.format(value);
}

/** "2026-12-01T03:00:00Z" → "30 de nov de 2026" (hora de Bogotá). */
export function formatDate(iso: string | Date): string {
  return shortDate.format(new Date(iso));
}
