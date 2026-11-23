import { z } from 'zod';
import { bogotaLocalToUtcIso } from '@/lib/dates';

/** Límites del API (`CreateOpportunityDto`). */
export const MIN_TITLE_LENGTH = 5;
export const MAX_TITLE_LENGTH = 120;
export const MIN_DESCRIPTION_LENGTH = 20;
export const MAX_DESCRIPTION_LENGTH = 3000;
export const MAX_CONDITIONS_LENGTH = 1000;
export const MAX_PEOPLE_NEEDED = 50;
export const MAX_PAYMENT_COP = 100_000_000;
export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_MINUTES = 365 * 24 * 60;

export const DURATION_UNITS = {
  minutes: { label: 'Minutos', minutes: 1 },
  hours: { label: 'Horas', minutes: 60 },
  days: { label: 'Días', minutes: 24 * 60 },
} as const;

export type DurationUnit = keyof typeof DURATION_UNITS;

/** "$ 70.000", "70.000" o "70000" -> 70000; `null` si no es un monto entero. */
export function parseCop(text: string): number | null {
  const digits = text.replace(/[\s$.]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

/** Duración en minutos (admite decimales con punto o coma, p. ej. "1,5" horas); `null` si no es válida. */
export function durationInMinutes(value: string, unit: DurationUnit): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * DURATION_UNITS[unit].minutes);
}

export const taskFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Escribe la actividad que necesitas.')
      .min(MIN_TITLE_LENGTH, `La actividad debe tener al menos ${MIN_TITLE_LENGTH} caracteres.`)
      .max(MAX_TITLE_LENGTH, `La actividad admite máximo ${MAX_TITLE_LENGTH} caracteres.`),
    description: z
      .string()
      .trim()
      .min(1, 'Describe lo que necesitas.')
      .min(
        MIN_DESCRIPTION_LENGTH,
        `Describe la necesidad con al menos ${MIN_DESCRIPTION_LENGTH} caracteres.`,
      )
      .max(
        MAX_DESCRIPTION_LENGTH,
        `La descripción admite máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`,
      ),
    categoryId: z.string().min(1, 'Elige una categoría.'),
    zoneId: z.string().min(1, 'Elige la zona de Cali.'),
    peopleNeeded: z
      .string()
      .trim()
      .min(1, 'Indica cuántas personas necesitas.')
      .refine(
        (value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= MAX_PEOPLE_NEEDED,
        `Indica un número de personas entre 1 y ${MAX_PEOPLE_NEEDED}.`,
      ),
    payment: z
      .string()
      .trim()
      .min(1, 'Indica el pago ofrecido.')
      .refine((value) => {
        const amount = parseCop(value);
        return amount !== null && amount > 0 && amount <= MAX_PAYMENT_COP;
      }, 'Indica el pago en pesos, mayor que cero y sin decimales.'),
    scheduledAt: z
      .string()
      .min(1, 'Indica la fecha y la hora.')
      .refine((value) => {
        const iso = bogotaLocalToUtcIso(value);
        return iso !== null && new Date(iso).getTime() > Date.now();
      }, 'La fecha debe ser posterior a la actual.'),
    durationValue: z.string().trim().min(1, 'Indica la duración.'),
    durationUnit: z.enum(['minutes', 'hours', 'days']),
    conditions: z
      .string()
      .trim()
      .max(
        MAX_CONDITIONS_LENGTH,
        `Las condiciones admiten máximo ${MAX_CONDITIONS_LENGTH} caracteres.`,
      ),
  })
  .superRefine((values, context) => {
    if (!values.durationValue) return;
    const minutes = durationInMinutes(values.durationValue, values.durationUnit);
    if (minutes === null) {
      context.addIssue({
        code: 'custom',
        path: ['durationValue'],
        message: 'Indica la duración con un número.',
      });
    } else if (minutes < MIN_DURATION_MINUTES) {
      context.addIssue({
        code: 'custom',
        path: ['durationValue'],
        message: `La duración mínima es de ${MIN_DURATION_MINUTES} minutos.`,
      });
    } else if (minutes > MAX_DURATION_MINUTES) {
      context.addIssue({
        code: 'custom',
        path: ['durationValue'],
        message: 'La duración máxima es de un año.',
      });
    }
  })
  .transform((values) => ({
    title: values.title,
    description: values.description,
    categoryId: Number(values.categoryId),
    zoneId: Number(values.zoneId),
    peopleNeeded: Number(values.peopleNeeded),
    paymentCop: parseCop(values.payment) as number,
    scheduledAt: bogotaLocalToUtcIso(values.scheduledAt) as string,
    durationMinutes: durationInMinutes(values.durationValue, values.durationUnit) as number,
    ...(values.conditions ? { conditions: values.conditions } : {}),
  }));

export type TaskFormValues = z.input<typeof taskFormSchema>;
export type TaskFormOutput = z.output<typeof taskFormSchema>;
