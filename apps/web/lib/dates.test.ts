import { describe, expect, it } from 'vitest';
import { bogotaLocalToUtcIso, formatBogotaDateTime } from './dates';

describe('bogotaLocalToUtcIso', () => {
  it('convierte la hora de Colombia (UTC-5) a UTC', () => {
    expect(bogotaLocalToUtcIso('2026-12-01T10:00')).toBe('2026-12-01T15:00:00.000Z');
  });

  it('pasa al día siguiente cuando la hora local cruza la medianoche UTC', () => {
    expect(bogotaLocalToUtcIso('2026-12-31T20:30')).toBe('2027-01-01T01:30:00.000Z');
  });

  it('admite segundos', () => {
    expect(bogotaLocalToUtcIso('2026-12-01T10:00:30')).toBe('2026-12-01T15:00:30.000Z');
  });

  it.each(['', 'mañana', '2026-12-01', '2026-13-45T10:00'])('rechaza "%s"', (value) => {
    expect(bogotaLocalToUtcIso(value)).toBeNull();
  });
});

describe('formatBogotaDateTime', () => {
  it('muestra la hora de Colombia, no la de UTC', () => {
    const text = formatBogotaDateTime('2026-12-01T15:00:00.000Z');
    expect(text).toContain('10:00');
    expect(text).not.toContain('15:00');
  });

  it('devuelve vacío con una fecha inválida', () => {
    expect(formatBogotaDateTime('no es fecha')).toBe('');
  });
});
