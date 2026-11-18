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

/** El formulario envía la imagen junto con los datos del perfil. */
export type CreatePublisherProfileRequest = {
  displayName: string;
  photo: File;
  description: string;
} & (
  | { kind: 'PERSON' }
  | { kind: 'COMPANY'; nit: string; nitCheckDigit: string; contactName: string; sector: string }
);

export type PublicPublisherProfile = {
  id: string;
  kind: 'PERSON' | 'COMPANY';
  displayName: string;
  photoUrl: string;
  description: string;
  sector: string | null;
  isVerified: boolean;
  reputation: { average: number | null; ratingsCount: number; completedJobs: number };
};

export type CreatePublisherProfileResult =
  | { ok: true; profile: { id: string } }
  | { ok: false; reason: 'already_exists'; id: string }
  | { ok: false; reason: 'nit_taken' };

export type ProfilesApi = {
  /**
   * Sube la foto y devuelve su URL. Provisional: en el Sprint 2 la subida será
   * directa a S3 con una URL firmada que emite la API.
   */
  uploadProfilePhoto(file: File): Promise<{ url: string }>;
  createWorkerProfile(request: CreateWorkerProfileRequest): Promise<CreateWorkerProfileResult>;
  createPublisherProfile(
    request: CreatePublisherProfileRequest,
  ): Promise<CreatePublisherProfileResult>;
  getPublicPublisherProfile(id: string): Promise<PublicPublisherProfile | null>;
};
