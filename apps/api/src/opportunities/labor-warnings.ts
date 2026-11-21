import { OpportunityType } from '@prisma/client';
import { normalizeSearch } from './search-text';

// HU-003 CA2 / RF-03-05 (Ley 2466 de 2025): advertencia informativa cuando las condiciones de una
// tarea, trabajo rápido, proyecto o servicio pueden indicar una relación laboral. No bloquea la
// publicación: exige que el publicador confirme que la leyó.
// Cada regla tiene un `code` fijo en el código y sus umbrales en `labor_warning_rules.params`,
// que el administrador puede ajustar. El texto (`message`) lo aprueba asesoría jurídica.

export type LaborWarningRuleRow = { code: string; message: string; params: unknown };

export type OpportunityConditions = {
  type: OpportunityType;
  durationMinutes?: number | null;
  description?: string | null;
  conditions?: string | null;
};

export type LaborWarning = { code: string; message: string };

const numberParam = (params: unknown, key: string, fallback: number) => {
  const value = (params as Record<string, unknown> | null)?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const listParam = (params: unknown, key: string) => {
  const value = (params as Record<string, unknown> | null)?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
};

type Evaluator = (input: OpportunityConditions, params: unknown) => boolean;

export const LABOR_WARNING_EVALUATORS: Record<string, Evaluator> = {
  // Jornada de 8 horas o más en una sola actividad.
  FULL_DAY: (input, params) =>
    (input.durationMinutes ?? 0) >= numberParam(params, 'minMinutes', 8 * 60),

  // Proyectos o servicios de un mes o más: continuidad propia de un empleo.
  LONG_TERM: (input, params) =>
    (input.type === OpportunityType.PROJECT || input.type === OpportunityType.SERVICE) &&
    (input.durationMinutes ?? 0) >= numberParam(params, 'minMinutes', 30 * 24 * 60),

  // Expresiones de subordinación u horario fijo en la descripción o las condiciones.
  SUBORDINATION_TERMS: (input, params) => {
    const text = normalizeSearch(`${input.description ?? ''} ${input.conditions ?? ''}`);
    return listParam(params, 'terms').some((term) => text.includes(normalizeSearch(term)));
  },
};

// Las vacantes formales ya son empleo: no llevan esta advertencia.
export const evaluateLaborWarnings = (
  input: OpportunityConditions,
  rules: LaborWarningRuleRow[],
): LaborWarning[] => {
  if (input.type === OpportunityType.FORMAL_JOB) return [];
  return rules
    .filter((rule) => LABOR_WARNING_EVALUATORS[rule.code]?.(input, rule.params) ?? false)
    .map(({ code, message }) => ({ code, message }));
};
