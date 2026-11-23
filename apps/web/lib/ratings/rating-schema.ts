import { z } from 'zod';

export const MAX_COMMENT_LENGTH = 500;

const score = (dimension: string) =>
  z
    .number()
    .int()
    .min(1)
    .max(5)
    .nullable()
    .refine((value) => value !== null, `Elige de 1 a 5 estrellas en ${dimension}.`);

/** Calificación de la contraparte (HU-007 CA1): las cuatro dimensiones son obligatorias. */
export const ratingSchema = z.object({
  fulfillment: score('cumplimiento'),
  punctuality: score('puntualidad'),
  communication: score('comunicación'),
  quality: score('calidad'),
  comment: z
    .string()
    .trim()
    .max(MAX_COMMENT_LENGTH, `El comentario admite máximo ${MAX_COMMENT_LENGTH} caracteres.`),
});

export type RatingFormValues = z.input<typeof ratingSchema>;
