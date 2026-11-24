import { authenticated, postJson } from './http';
import type { AdminApi } from './admin';
const query = (value?: string) => (value ? `?${value}` : '');
export const adminApi: AdminApi = {
  reports: (value) => authenticated(`/admin/reports${query(value)}`),
  users: (value) => authenticated(`/admin/users${query(value)}`),
  audit: (value) => authenticated(`/admin/audit${query(value)}`),
  categories: () => authenticated('/admin/categories'),
  rules: () => authenticated('/admin/labor-warning-rules'),
  action: (path, body) => authenticated(path, postJson(body)),
};
