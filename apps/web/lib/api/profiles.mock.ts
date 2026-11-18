import { authenticated } from './http';
import type { ProfilesApi } from './profiles';

// HU-002 conserva su adaptador local hasta que se incorpore el endpoint de trabajador.
const workerKey = (userId: string) => `red:worker-profile:${userId}`;
const localProfiles = new Set<string>();
export function hasLocalWorkerProfile(userId: string) {
  try {
    return localProfiles.has(userId) || sessionStorage.getItem(workerKey(userId)) !== null;
  } catch {
    return localProfiles.has(userId);
  }
}

export const workerProfilesApi: Pick<ProfilesApi, 'uploadProfilePhoto' | 'createWorkerProfile'> = {
  async uploadProfilePhoto(file) {
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
    });
    return { url };
  },
  async createWorkerProfile(request) {
    const user = await authenticated<{ id: string; hasWorkerProfile: boolean }>('/auth/me');
    if (user.hasWorkerProfile || hasLocalWorkerProfile(user.id))
      return { ok: false, reason: 'already_exists' };
    const profile = { ...request, id: crypto.randomUUID(), availability: 'AVAILABLE' as const };
    localProfiles.add(user.id);
    try {
      sessionStorage.setItem(workerKey(user.id), JSON.stringify(profile));
    } catch {
      /* Sin almacenamiento disponible, la demo dura lo que dura la pestaña. */
    }
    return { ok: true, profile };
  },
};
