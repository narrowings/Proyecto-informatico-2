/**
 * El API recibe y devuelve fechas ISO 8601 en UTC; la web las muestra y las pide en
 * hora de Colombia (America/Bogota). Colombia no tiene horario de verano: siempre UTC-5.
 */
export const BOGOTA_TIME_ZONE = 'America/Bogota';
const BOGOTA_OFFSET = '-05:00';

/** Convierte el valor de un `datetime-local` (hora de Colombia) a ISO 8601 en UTC. */
export function bogotaLocalToUtcIso(local: string): string | null {
  const value = local.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const date = new Date(`${value.length === 16 ? `${value}:00` : value}${BOGOTA_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const dateTime = new Intl.DateTimeFormat('es-CO', {
  timeZone: BOGOTA_TIME_ZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Fecha y hora de Colombia para mostrar, p. ej. "1 dic 2026, 10:00 a. m.". */
export function formatBogotaDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateTime.format(date);
}
