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
  list(query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(
      ([key, value]) => value !== undefined && params.set(key, String(value)),
    );
    return authenticated(`/opportunities?${params}`);
  },
  async get(id) {
    try {
      return {
        status: 'found',
        opportunity: await authenticated(`/opportunities/${encodeURIComponent(id)}`),
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return { status: 'not_found' };
      throw error;
    }
  },
  async apply(id, message) {
    try {
      await authenticated(
        `/opportunities/${encodeURIComponent(id)}/applications`,
        postJson(message ? { message } : {}),
      );
      return { status: 'applied' };
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 404) return { status: 'not_found' };
        if (error.problem.code === 'EMAIL_NOT_CONFIRMED') return { status: 'email_not_confirmed' };
        if (error.problem.code === 'WORKER_PROFILE_REQUIRED')
          return { status: 'no_worker_profile' };
        if (error.problem.code === 'OWN_OPPORTUNITY') return { status: 'own_opportunity' };
        if (error.status === 429) return { status: 'rate_limited' };
        if (error.status === 400 && error.problem.errors)
          return { status: 'invalid', errors: error.problem.errors };
        if (error.problem.code === 'ALREADY_APPLIED') return { status: 'already_applied' };
        if (error.problem.code === 'OPPORTUNITY_NOT_AVAILABLE') return { status: 'closed' };
      }
      throw error;
    }
  },
  applicationStatus(ids) {
    return authenticated(
      `/applications/status?opportunityIds=${ids.map(encodeURIComponent).join(',')}`,
    );
  },
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
