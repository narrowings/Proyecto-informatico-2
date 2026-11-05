import { describe, expect, it } from 'vitest';
import { nitCheckDigit, parseNit } from './nit';

describe('NIT', () => {
  it.each([
    ['890903938', 8],
    ['890900608', 9],
    ['800197268', 4],
  ])('calcula el dígito de verificación de %s', (base, digit) => {
    expect(nitCheckDigit(base)).toBe(digit);
  });

  it.each(['890.903.938-8', '890903938-8', '8909039388', ' 890 903 938-8 '])(
    'acepta el formato %s',
    (raw) => {
      expect(parseNit(raw)).toEqual({ base: '890903938', checkDigit: '8' });
    },
  );

  it.each(['890903938-7', '12345', 'abc', '890903938-'])('rechaza %s', (raw) => {
    expect(parseNit(raw)).toBeNull();
  });
});
