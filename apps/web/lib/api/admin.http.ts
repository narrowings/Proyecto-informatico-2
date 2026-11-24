import { ApiError, authenticated, postJson } from './http';
import type { AdminApi } from './admin';
const outcome = async (path: string, reason: string) => {
  try {
    await authenticated(path, postJson({ reason }));
    return { status: 'ok' } as const;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 403) return { status: 'forbidden' } as const;
      if (error.status === 404) return { status: 'not_found' } as const;
      if (error.status === 400 && error.problem.errors)
        return { status: 'invalid', errors: error.problem.errors } as const;
      const codes = {
        ALREADY_HIDDEN: 'already_hidden',
        NOT_HIDDEN: 'not_hidden',
        INVALID_ACCOUNT_STATE: 'invalid_account_state',
        CANNOT_MODERATE_ADMIN: 'cannot_moderate_admin',
        CATEGORY_EXISTS: 'category_exists',
      } as const;
      const status = codes[error.problem.code as keyof typeof codes];
      if (status) return { status } as const;
    }
    throw error;
  }
};
export const adminApi: AdminApi = {
  reports: (value) => authenticated(`/admin/reports?${value}`),
  users: (value) => authenticated(`/admin/users?${value}`),
  audit: (value) => authenticated(`/admin/audit?${value}`),
  categories: () => authenticated('/admin/categories'),
  rules: () => authenticated('/admin/labor-warning-rules'),
  moderate: outcome,
};
