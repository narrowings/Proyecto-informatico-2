import { ApiError, authenticated } from './http';
import type { CurrentUser, SessionApi } from './session';
import { hasLocalWorkerProfile } from './profiles.mock';

export const sessionApi: SessionApi = {
  async getCurrentUser() {
    try {
      const user = await authenticated<CurrentUser>('/auth/me');
      return { ...user, hasWorkerProfile: user.hasWorkerProfile || hasLocalWorkerProfile(user.id) };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
};
