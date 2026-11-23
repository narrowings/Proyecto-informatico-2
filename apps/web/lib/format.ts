/**
 * Formatos de la interfaz (RNF-USA-07): español de Colombia y hora de
 * America/Bogota. El API envía las fechas en UTC (ISO 8601).
 */

const TIME_ZONE = 'America/Bogota';

const rating = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 4.8 → "4,8" */
export function formatRating(value: number): string {
  return rating.format(value);
}

const shortDate = new Intl.DateTimeFormat('es-CO', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "2026-12-01T03:00:00Z" → "30 de nov de 2026" (hora de Bogotá). */
export function formatDate(iso: string | Date): string {
  return shortDate.format(new Date(iso));
}
