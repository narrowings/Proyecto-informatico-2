import { describe, expect, it } from 'vitest';
import { isSecureCookie, readCookie } from './cookies';

describe('readCookie', () => {
  it('lee la cookie pedida entre varias', () => {
    expect(readCookie('a=1; refresh_token=abc-123_x; b=2', 'refresh_token')).toBe('abc-123_x');
  });

  it('conserva los = dentro del valor', () => {
    expect(readCookie('refresh_token=abc==', 'refresh_token')).toBe('abc==');
  });

  it('devuelve undefined si no existe, no hay cabecera o el valor está mal codificado', () => {
    expect(readCookie('a=1', 'refresh_token')).toBeUndefined();
    expect(readCookie(undefined, 'refresh_token')).toBeUndefined();
    expect(readCookie('refresh_token=%E0%A4%A', 'refresh_token')).toBeUndefined();
  });
});
describe('isSecureCookie', () => {
  it('solo en desarrollo local la cookie viaja sin Secure', () => {
    expect(isSecureCookie('development')).toBe(false);
  });

  it('en QA, producción, pruebas o sin NODE_ENV lleva Secure', () => {
    for (const env of ['production', 'qa', 'test', undefined]) {
      expect(isSecureCookie(env)).toBe(true);
    }
  });
});
