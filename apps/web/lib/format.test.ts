import { describe, expect, it } from 'vitest';
import { formatCop, waitMessage } from './format';

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
