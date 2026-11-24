import { ApiError, authenticated, postJson } from './http';
import type { ReportsApi } from './reports';

export const reportsApi: ReportsApi = {
  async create(input) {
    try {
      const { message } = await authenticated<{ id: string; message: string }>(
        '/reports',
        postJson(input),
      );
      return { status: 'reported', message };
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.problem.code === 'ALREADY_REPORTED') return { status: 'already_reported' };
        if (error.problem.code === 'CANNOT_REPORT_SELF') return { status: 'cannot_report_self' };
        if (error.status === 404) return { status: 'not_found' };
        if (error.status === 429) return { status: 'rate_limited' };
        if (error.status === 400 && error.problem.errors)
          return { status: 'invalid', errors: error.problem.errors };
      }
      throw error;
    }
  },
};
