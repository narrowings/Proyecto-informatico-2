import { readMockState, wait, writeMockState } from './mock-state';
import type { ProfilesApi } from './profiles';

/**
 * Perfiles simulados. La foto no se sube a ningún lado: se devuelve una URL de
 * ejemplo, porque la subida real a S3 llega en el Sprint 2.
 */
export const mockProfilesApi: ProfilesApi = {
  async uploadProfilePhoto(file) {
    await wait(300);
    return { url: `https://media.example.test/perfiles/${encodeURIComponent(file.name)}` };
  },

  async createWorkerProfile(request) {
    await wait();
    const state = readMockState();
    if (state.workerProfile) return { ok: false, reason: 'already_exists' };

    const profile = { ...request, id: crypto.randomUUID(), availability: 'AVAILABLE' as const };
    writeMockState({ ...state, workerProfile: profile });
    return { ok: true, profile };
  },
};
