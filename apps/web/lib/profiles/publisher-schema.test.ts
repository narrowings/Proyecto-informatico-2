import { describe, expect, it } from 'vitest';
import { publisherProfileSchema, validNit } from './publisher-schema';

const person = {
  kind: 'PERSON',
  displayName: ' Ana Pérez ',
  description: ' Servicios en Cali ',
  photo: new File(['foto'], 'foto.png', { type: 'image/png' }),
};
const company = {
  ...person,
  kind: 'COMPANY',
  nit: '800197268',
  nitCheckDigit: '4',
  contactName: 'Ana Pérez',
  sector: 'Servicios',
};

describe('HU-008 validación de perfiles', () => {
  it('normaliza los campos y omite datos de empresa al crear persona natural', () => {
    expect(publisherProfileSchema.parse({ ...company, kind: 'PERSON' })).toEqual({
      ...person,
      displayName: 'Ana Pérez',
      description: 'Servicios en Cali',
    });
  });
  it('valida el NIT y su dígito por separado', () => {
    expect(validNit('800197268', '4')).toBe(true);
    expect(publisherProfileSchema.safeParse(company).success).toBe(true);
    for (const nit of ['800.197.268', '800197268-4', 'abc', '000', '12345678901'])
      expect(validNit(nit, '4')).toBe(false);
    expect(validNit('800197268', '3')).toBe(false);
  });
  it.each(['displayName', 'description', 'contactName', 'sector', 'nit', 'nitCheckDigit'])(
    'exige %s en empresas',
    (field) => {
      expect(publisherProfileSchema.safeParse({ ...company, [field]: ' ' }).success).toBe(false);
    },
  );
  it('rechaza una imagen ausente, de tipo no soportado o demasiado grande', () => {
    for (const photo of [
      null,
      new File(['x'], 'archivo.svg', { type: 'image/svg+xml' }),
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'foto.png', { type: 'image/png' }),
    ]) {
      expect(publisherProfileSchema.safeParse({ ...person, photo }).success).toBe(false);
    }
  });
});
