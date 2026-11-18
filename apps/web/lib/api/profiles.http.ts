import { z } from 'zod';
import { ApiError, API_ORIGIN, authenticated, request } from './http';
import type { ProfilesApi, PublicPublisherProfile } from './profiles';
import { workerProfilesApi } from './profiles.mock';

export const profilesApi: ProfilesApi = {
  ...workerProfilesApi,
  async createPublisherProfile({ photo, ...details }) {
    const body = new FormData();
    body.set('photo', photo);
    body.set('kind', details.kind);
    body.set('displayName', details.displayName);
    body.set('description', details.description);
    if (details.kind === 'COMPANY') {
      body.set('nit', `${details.nit}-${details.nitCheckDigit}`);
      body.set('contactName', details.contactName);
      body.set('sector', details.sector);
    }
    try {
      const profile = await authenticated<{ id: string }>('/profiles/publisher/with-photo', {
        method: 'POST',
        body,
      });
      return { ok: true, profile };
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        if (error.problem.code === 'NIT_TAKEN') return { ok: false, reason: 'nit_taken' };
        if (error.problem.code === 'PUBLISHER_EXISTS') {
          const own = await authenticated<{ id: string }>('/profiles/publisher/me');
          return { ok: false, reason: 'already_exists', id: own.id };
        }
      }
      throw error;
    }
  },
  async getPublicPublisherProfile(id) {
    if (!z.uuid().safeParse(id).success) return null;
    try {
      const profile = await request<PublicPublisherProfile>(
        `/profiles/publisher/${encodeURIComponent(id)}`,
        { credentials: 'omit' },
      );
      return { ...profile, photoUrl: new URL(profile.photoUrl, API_ORIGIN).href };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
};
