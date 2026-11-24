import type { NewFormalOpportunity, WorkModality, WorkSchedule } from '@/lib/api/opportunities';
import { bogotaLocalToUtcIso } from '@/lib/dates';
import { MAX_PAYMENT_COP, parseCop } from './task-schema';

/** Lo que escribe el publicador en el formulario de vacante formal (HU-024). */
export type FormalFormValues = {
  title: string;
  description: string;
  categoryId: string;
  zoneId: string;
  salaryMin: string;
  salaryMax: string;
  modality: '' | WorkModality;
  schedule: '' | WorkSchedule;
  experienceRequired: string;
  requirements: string;
  /** `datetime-local` en hora de Colombia. */
  closesAt: string;
};

export const emptyFormal: FormalFormValues = {
  title: '',
  description: '',
  categoryId: '',
  zoneId: '',
  salaryMin: '',
  salaryMax: '',
  modality: '',
  schedule: '',
  experienceRequired: '',
  requirements: '',
  closesAt: '',
};

/** Valida con los límites del API; devuelve la vacante lista para enviar o los errores por campo. */
export function validateFormal(
  values: FormalFormValues,
  now = new Date(),
): { ok: true; input: NewFormalOpportunity } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const title = values.title.trim();
  const description = values.description.trim();
  const experience = values.experienceRequired.trim();
  const requirements = values.requirements.trim();
  if (title.length < 5 || title.length > 120)
    errors.title = 'El cargo debe tener entre 5 y 120 caracteres.';
  if (description.length < 20 || description.length > 3000)
    errors.description = 'Describe la vacante con 20 a 3000 caracteres.';
  if (!values.categoryId) errors.categoryId = 'Elige una categoría.';
  if (!values.zoneId) errors.zoneId = 'Elige la zona de Cali.';
  const min = parseCop(values.salaryMin);
  const max = values.salaryMax.trim() ? parseCop(values.salaryMax) : undefined;
  if (!min || min > MAX_PAYMENT_COP)
    errors.salaryMin = 'Indica el salario en pesos, mayor que cero.';
  if (max === null || (max !== undefined && max > MAX_PAYMENT_COP))
    errors.salaryMax = 'Indica el salario máximo en pesos.';
  else if (min && max !== undefined && max < min)
    errors.salaryMax = 'El salario máximo no puede ser menor que el mínimo.';
  if (!values.modality) errors.modality = 'Elige la modalidad.';
  if (!values.schedule) errors.schedule = 'Elige la jornada.';
  if (!experience || experience.length > 500)
    errors.experienceRequired = 'Indica la experiencia requerida (hasta 500 caracteres).';
  if (!requirements || requirements.length > 2000)
    errors.requirements = 'Indica los requisitos (hasta 2000 caracteres).';
  const closesAt = bogotaLocalToUtcIso(values.closesAt);
  if (!closesAt) errors.closesAt = 'Indica la fecha de cierre.';
  else if (new Date(closesAt) <= now) errors.closesAt = 'La fecha de cierre debe ser futura.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    input: {
      title,
      description,
      categoryId: Number(values.categoryId),
      zoneId: Number(values.zoneId),
      salaryMinCop: min!,
      ...(max ? { salaryMaxCop: max } : {}),
      modality: values.modality as WorkModality,
      schedule: values.schedule as WorkSchedule,
      experienceRequired: experience,
      requirements,
      closesAt: closesAt!,
    },
  };
}
