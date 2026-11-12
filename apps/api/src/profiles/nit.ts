import { registerDecorator, ValidationOptions } from 'class-validator';

// Pesos de la DIAN para el dígito de verificación, aplicados de derecha a izquierda.
const WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

export const nitCheckDigit = (base: string) => {
  const sum = [...base].reverse().reduce((acc, digit, i) => acc + Number(digit) * WEIGHTS[i], 0);
  const remainder = sum % 11;
  return remainder > 1 ? 11 - remainder : remainder;
};

// Acepta "900.123.456-7", "900123456-7" o "9001234567" (el último dígito es el de verificación).
export const parseNit = (raw: string) => {
  const match = /^(\d{6,10})-?(\d)$/.exec(raw.replace(/[.\s]/g, ''));
  if (!match) return null;
  const [, base, checkDigit] = match;
  return nitCheckDigit(base) === Number(checkDigit) ? { base, checkDigit } : null;
};

export function IsNit(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isNit',
      target: object.constructor,
      propertyName,
      options: { message: 'El NIT no es válido; revisa el dígito de verificación', ...options },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && parseNit(value) !== null,
      },
    });
}
