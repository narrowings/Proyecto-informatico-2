import { describe, expect, it } from 'vitest';
import { isStrongPassword, registerSchema } from './schemas';

const valid = {
  name: 'Ana Pérez',
  email: 'ana@example.com',
  phone: '3001234567',
  password: 'Segura123',
  termsAccepted: true,
  privacyAccepted: true,
  dataAuthorization: true,
  isAdult: true,
};

describe('isStrongPassword (HU-001: mín. 8, mayúscula, minúscula y número)', () => {
  it.each([
    ['Segura123', true],
    ['Abcdefg1', true],
    ['Corta1A', false],
    ['sinmayuscula1', false],
    ['SINMINUSCULA1', false],
    ['SinNumeroAqui', false],
  ])('%s -> %s', (password, expected) => {
    expect(isStrongPassword(password)).toBe(expected);
  });
});

describe('registerSchema', () => {
  it('acepta un registro completo', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('marca cada campo vacío con su propio error (HU-001 CA4)', () => {
    const result = registerSchema.safeParse({
      ...valid,
      name: '',
      email: '',
      phone: '',
      password: '',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const fields = result.error.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'phone', 'password']));
  });

  it('rechaza un correo con formato inválido (HU-001 CA4)', () => {
    const result = registerSchema.safeParse({ ...valid, email: 'no-es-un-correo' });
    expect(result.success).toBe(false);
  });

  it('rechaza una contraseña débil (HU-001 CA4)', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'debil' }).success).toBe(false);
  });

  it.each(['termsAccepted', 'privacyAccepted', 'dataAuthorization', 'isAdult'] as const)(
    'exige la casilla %s (HU-017)',
    (field) => {
      const result = registerSchema.safeParse({ ...valid, [field]: false });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual([field]);
    },
  );
});
