import { ApiError, authenticated, postJson } from './http';
import type { LaborWarning, OpportunitiesApi } from './opportunities';

/** El API manda las advertencias en el cuerpo del 409; `ApiError` solo tipa code y message. */
function warningsOf(error: ApiError): LaborWarning[] {
  const { warnings } = error.problem as { warnings?: unknown };
  return Array.isArray(warnings)
    ? warnings.filter(
        (item): item is LaborWarning =>
          typeof item?.code === 'string' && typeof item?.message === 'string',
      )
    : [];
}

export const opportunitiesApi: OpportunitiesApi = {
  async previewLaborWarnings(input) {
    const { warnings } = await authenticated<{ warnings: LaborWarning[] }>(
      '/opportunities/labor-warnings',
      postJson(input),
    );
    return warnings;
  },

  async publish(input, acknowledgeLaborWarning) {
    const body = acknowledgeLaborWarning ? { ...input, acknowledgeLaborWarning: true } : input;
    try {
      const created = await authenticated<{ id: string }>('/opportunities', postJson(body));
      return { ok: true, id: created.id };
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.problem.code === 'LABOR_WARNING_REQUIRED'
      ) {
        return { ok: false, reason: 'labor_warning_required', warnings: warningsOf(error) };
      }
      throw error;
    }
  },
};
