/**
 * Contrato del perfil de trabajador (HU-002) con `POST /v1/profiles/worker`.
 * El formulario envía la foto junto con los datos, como el perfil de publicador.
 */

export type WorkerAvailability = 'AVAILABLE' | 'UNAVAILABLE';

export type CreateWorkerProfileRequest = {
  displayName: string;
  photo: File;
  skills: string[];
  experience?: string;
  zoneId: number;
  categoryIds: number[];
};

export type WorkerProfile = Omit<CreateWorkerProfileRequest, 'photo'> & {
  id: string;
  photoUrl: string;
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
  createWorkerProfile(request: CreateWorkerProfileRequest): Promise<CreateWorkerProfileResult>;
  createPublisherProfile(
    request: CreatePublisherProfileRequest,
  ): Promise<CreatePublisherProfileResult>;
  getPublicPublisherProfile(id: string): Promise<PublicPublisherProfile | null>;
};
