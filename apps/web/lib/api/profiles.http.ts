import { z } from 'zod';
import { ApiError, API_ORIGIN, authenticated, request } from './http';
import type {
  ProfilesApi,
  PublicPublisherProfile,
  PublicWorkerProfile,
  WorkerProfile,
} from './profiles';

export const profilesApi: ProfilesApi = {
  async createWorkerProfile({ photo, ...details }) {
    const body = new FormData();
    body.set('photo', photo);
    body.set('displayName', details.displayName);
    body.set('skills', JSON.stringify(details.skills));
    if (details.experience) body.set('experience', details.experience);
    body.set('zoneId', String(details.zoneId));
    body.set('categoryIds', JSON.stringify(details.categoryIds));
    try {
      const profile = await authenticated<WorkerProfile>('/profiles/worker', {
        method: 'POST',
        body,
      });
      return {
        ok: true,
        profile: { ...profile, photoUrl: new URL(profile.photoUrl, API_ORIGIN).href },
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        return { ok: false, reason: 'already_exists' };
      throw error;
    }
  },
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
  async getPublicWorkerProfile(id) {
    if (!z.uuid().safeParse(id).success) return null;
    try {
      const profile = await request<PublicWorkerProfile>(
        `/profiles/worker/${encodeURIComponent(id)}`,
        { credentials: 'omit' },
      );
      return { ...profile, photoUrl: absolutePhotoUrl(profile.photoUrl) };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
};

/** El API devuelve rutas relativas; `null` significa foto oculta (HU-030). */
export function absolutePhotoUrl(photoUrl: string | null): string | null {
  return photoUrl ? new URL(photoUrl, API_ORIGIN).href : null;
}
