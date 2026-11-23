import { describe, expect, it } from 'vitest';
import { formatDate, formatRating } from './format';

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
