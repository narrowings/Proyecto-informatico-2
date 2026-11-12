import type { CurrentUser } from './session';
import type { PublisherProfile, WorkerProfile } from './profiles';

/**
 * Estado compartido de las API simuladas mientras no existan los endpoints de
 * sesiones (HU-021) y perfiles (HU-002). Se guarda en sessionStorage para que
 * un perfil creado siga ahí al recargar la página durante una demo.
 */

type MockState = {
  user: Omit<CurrentUser, 'hasWorkerProfile'> | null;
  workerProfile: WorkerProfile | null;
  publisherProfile: PublisherProfile | null;
};

const STORAGE_KEY = 'red:mock-state';

const initialState = (): MockState => ({
  // Usuaria de demostración con sesión iniciada y sin perfiles.
  user: { id: 'usuario-demo', name: 'Ana Pérez', hasPublisherProfile: false },
  workerProfile: null,
  publisherProfile: null,
});

let memory: MockState | null = null;

export function readMockState(): MockState {
  if (memory) return memory;
  try {
    const saved = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    memory = saved ? ({ ...initialState(), ...JSON.parse(saved) } as MockState) : initialState();
  } catch {
    memory = initialState();
  }
  return memory;
}

export function writeMockState(next: MockState): void {
  memory = next;
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento disponible (modo privado): el estado vive solo en memoria.
  }
}

export const wait = (ms = 400) => new Promise<void>((resolve) => setTimeout(resolve, ms));
