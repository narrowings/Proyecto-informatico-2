import { describe, expect, it } from 'vitest';
import { isInternalPath } from './internal-path';

describe('isInternalPath', () => {
  it.each(['/mi-actividad', '/mi-actividad/trabajos/1?x=2', '/'])(
    'acepta la ruta interna %s',
    (link) => {
      expect(isInternalPath(link)).toBe(true);
    },
  );

  it.each([
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '',
    null,
    undefined,
  ])('rechaza %s (redirección abierta)', (link) => {
    expect(isInternalPath(link)).toBe(false);
  });
});
