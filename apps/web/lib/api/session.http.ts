import { ApiError, authenticated } from './http';
import type { CurrentUser, SessionApi } from './session';

export const sessionApi: SessionApi = {
  async getCurrentUser() {
    try {
      return await authenticated<CurrentUser>('/auth/me');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
};
