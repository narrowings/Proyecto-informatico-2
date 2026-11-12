import { readMockState, wait, writeMockState } from './mock-state';
import type { ProfilesApi } from './profiles';

/**
 * Perfiles simulados. La imagen vive en el navegador para la demo; la subida
 * real a S3 llega en el Sprint 2.
 */
export const mockProfilesApi: ProfilesApi = {
  async uploadProfilePhoto(file) {
    await wait(300);
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
    });
    return { url };
  },

  async createWorkerProfile(request) {
    await wait();
    const state = readMockState();
    if (state.workerProfile) return { ok: false, reason: 'already_exists' };

    const profile = { ...request, id: crypto.randomUUID(), availability: 'AVAILABLE' as const };
    writeMockState({ ...state, workerProfile: profile });
    return { ok: true, profile };
  },

  async createPublisherProfile(request) {
    await wait();
    const state = readMockState();
    if (!state.user) throw new Error('Sesión requerida.');
    if (state.publisherProfile) return { ok: false, reason: 'already_exists' };
    const profile = { ...request, id: crypto.randomUUID(), isVerified: false };
    writeMockState({ ...state, publisherProfile: profile });
    return { ok: true, profile };
  },

  async getPublicPublisherProfile(id) {
    await wait();
    const profile = readMockState().publisherProfile;
    if (!profile || profile.id !== id) return null;
    const { kind, displayName, photoUrl, description, isVerified } = profile;
    return { id, kind, displayName, photoUrl, description, isVerified };
  },
};
