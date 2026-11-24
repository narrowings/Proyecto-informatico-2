import { describe, expect, it } from 'vitest';
import { formatCop, formatDate, formatRating, waitMessage } from './format';

describe('formatCop', () => {
  it.each([
    [150000, '$ 150.000'],
    [70000, '$ 70.000'],
    [999, '$ 999'],
    [1000000, '$ 1.000.000'],
    [0, '$ 0'],
  ])('%i -> %s', (amount, expected) => {
    expect(formatCop(amount)).toBe(expected);
  });
});

describe('waitMessage', () => {
  it('redondea hacia arriba a minutos', () => {
    expect(waitMessage(61)).toBe('Inténtalo de nuevo en 2 minutos.');
    expect(waitMessage(600)).toBe('Inténtalo de nuevo en 10 minutos.');
  });

  it('usa singular con un minuto o menos', () => {
    expect(waitMessage(30)).toBe('Inténtalo de nuevo en 1 minuto.');
  });

  it('sin dato de espera (cabecera ausente) no inventa un tiempo', () => {
    expect(waitMessage(Number.NaN)).toBe('Inténtalo de nuevo más tarde.');
    expect(waitMessage(0)).toBe('Inténtalo de nuevo más tarde.');
  });
});

describe('formatRating', () => {
  it('usa coma decimal y siempre un decimal', () => {
    expect(formatRating(4.8)).toBe('4,8');
    expect(formatRating(5)).toBe('5,0');
    expect(formatRating(4.25)).toMatch(/^4,[23]$/);
  });
});

describe('formatDate', () => {
  it('muestra la fecha en hora de Bogotá (UTC-5)', () => {
    // 03:00 UTC del 1 de diciembre son las 22:00 del 30 de noviembre en Bogotá.
    expect(formatDate('2026-12-01T03:00:00.000Z')).toMatch(/^30 de nov/);
  });
});
