import { describe, expect, it } from 'vitest';
import { readCookie } from './cookies';

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