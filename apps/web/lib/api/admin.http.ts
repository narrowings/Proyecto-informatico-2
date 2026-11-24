import { ApiError, authenticated, postJson } from './http';
import { moderationPath, type AdminApi, type AdminResult } from './admin';

const CODES = {
  ALREADY_HIDDEN: 'already_hidden',
  NOT_HIDDEN: 'not_hidden',
  INVALID_ACCOUNT_STATE: 'invalid_account_state',
  CANNOT_MODERATE_ADMIN: 'cannot_moderate_admin',
  CATEGORY_EXISTS: 'category_exists',
} as const;

/** Ejecuta una mutación y traduce los errores esperados a un estado. */
async function outcome(path: string, init: RequestInit): Promise<AdminResult> {
  try {
    await authenticated(path, init);
    return { status: 'ok' };
  } catch (error) {
    if (error instanceof ApiError) {
      const known = CODES[error.problem.code as keyof typeof CODES];
      if (known) return { status: known };
      if (error.status === 403) return { status: 'forbidden' };
      if (error.status === 404) return { status: 'not_found' };
      if (error.status === 400 && error.problem.errors)
        return { status: 'invalid', errors: error.problem.errors };
    }
    throw error;
  }
}

const patchJson = (body: object): RequestInit => ({ ...postJson(body), method: 'PATCH' });

export const adminApi: AdminApi = {
  reports: (query) => authenticated(`/admin/reports?${query}`),
  reportDetail: (type, id) => authenticated(`/admin/reports/${type}/${encodeURIComponent(id)}`),
  users: (query) => authenticated(`/admin/users?${query}`),
  audit: (query) => authenticated(`/admin/audit?${query}`),
  categories: () => authenticated('/admin/categories'),
  rules: () => authenticated('/admin/labor-warning-rules'),
  moderate: (action, reason) => outcome(moderationPath(action), postJson({ reason })),
  createCategory: (input) => outcome('/admin/categories', postJson(input)),
  updateCategory: (id, input) => outcome(`/admin/categories/${id}`, patchJson(input)),
  updateRule: (code, input) => outcome(`/admin/labor-warning-rules/${code}`, patchJson(input)),
};
