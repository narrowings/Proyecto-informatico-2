import { readMockState, wait } from './mock-state';
import type { SessionApi } from './session';

/** Sesión simulada: siempre hay una usuaria de demostración con sesión iniciada. */
export const mockSessionApi: SessionApi = {
  async getCurrentUser() {
    await wait(200);
    const { user, workerProfile, publisherProfile } = readMockState();
    return user
      ? {
          ...user,
          hasWorkerProfile: workerProfile !== null,
          hasPublisherProfile: publisherProfile !== null,
          publisherProfileId: publisherProfile?.id,
        }
      : null;
  },
};
