import { z } from 'zod';
import { photoSchema } from './worker-schema';

/** Límites de PublisherProfile (T-01). NIT y dígito se guardan por separado. */
export const MAX_PUBLISHER_NAME_LENGTH = 160;
export const MAX_DESCRIPTION_LENGTH = 1000;

export function validNit(nit: string, digit: string): boolean {
  if (!/^\d{1,10}$/.test(nit) || !/^[0-9]$/.test(digit) || /^0+$/.test(nit)) return false;
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43];
  const sum = [...nit]
    .reverse()
    .reduce((total, value, index) => total + Number(value) * weights[index], 0);
  const remainder = sum % 11;
  return Number(digit) === (remainder > 1 ? 11 - remainder : remainder);
}

const common = {
  displayName: z
    .string()
    .trim()
    .min(1, 'Ingresa el nombre o razón social.')
    .max(MAX_PUBLISHER_NAME_LENGTH),
  description: z.string().trim().min(1, 'Describe tu actividad.').max(MAX_DESCRIPTION_LENGTH),
  photo: photoSchema,
};

export const publisherProfileSchema = z.discriminatedUnion('kind', [
  z.object({ ...common, kind: z.literal('PERSON') }),
  z
    .object({
      ...common,
      kind: z.literal('COMPANY'),
      nit: z
        .string()
        .trim()
        .regex(/^\d{1,10}$/, 'Ingresa el NIT sin puntos ni dígito de verificación.'),
      nitCheckDigit: z.string().trim().regex(/^\d$/, 'Ingresa el dígito de verificación.'),
      contactName: z
        .string()
        .trim()
        .min(1, 'Ingresa el nombre del contacto o representante.')
        .max(120),
      sector: z.string().trim().min(1, 'Ingresa el sector de la empresa.').max(100),
    })
    .refine((values) => validNit(values.nit, values.nitCheckDigit), {
      path: ['nitCheckDigit'],
      message: 'El dígito de verificación no corresponde al NIT.',
    }),
]);

export type PublisherProfileFormValues = z.input<typeof publisherProfileSchema>;
export type PublisherProfileFormOutput = z.output<typeof publisherProfileSchema>;
