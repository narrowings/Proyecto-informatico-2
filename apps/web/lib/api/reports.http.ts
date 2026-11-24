import { authenticated, postJson } from './http';
import type { ReportsApi } from './reports';

export const reportsApi: ReportsApi = {
  create(input) {
    return authenticated('/reports', postJson(input));
  },
};
