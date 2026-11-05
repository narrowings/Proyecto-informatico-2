/**
 * Contrato provisional del perfil de trabajador (HU-002), alineado con el
 * modelo `WorkerProfile` de Prisma (T-01). Debe reemplazarse por el cliente
 * generado de @red/contracts cuando exista el contrato de HU-002.
 */

export type WorkerAvailability = 'AVAILABLE' | 'UNAVAILABLE';

export type CreateWorkerProfileRequest = {
  displayName: string;
  photoUrl: string;
  skills: string[];
  experience?: string;
  zoneId: number;
  categoryIds: number[];
};

export type WorkerProfile = CreateWorkerProfileRequest & {
  id: string;
  /** HU-002 CA1: al crear el perfil queda "Disponible". */
  availability: WorkerAvailability;
};

export type CreateWorkerProfileResult =
  { ok: true; profile: WorkerProfile } | { ok: false; reason: 'already_exists' };

export type ProfilesApi = {
  /**
   * Sube la foto y devuelve su URL. Provisional: en el Sprint 2 la subida será
   * directa a S3 con una URL firmada que emite la API.
   */
  uploadProfilePhoto(file: File): Promise<{ url: string }>;
  createWorkerProfile(request: CreateWorkerProfileRequest): Promise<CreateWorkerProfileResult>;
};
