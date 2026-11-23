/**
 * Contrato del perfil de trabajador (HU-002) con `POST /v1/profiles/worker`.
 * El formulario envía la foto junto con los datos, como el perfil de publicador.
 */

import type { Reputation } from './reputation';

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

/**
 * Perfil público del trabajador (HU-029, HU-030). Lista blanca del API: sin
 * correo, teléfono, dirección ni documentos. `photoUrl` y `experience` llegan en
 * `null` si la persona eligió ocultarlos.
 */
export type PublicWorkerProfile = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  skills: string[];
  experience: string | null;
  zone: { id: number; name: string };
  categories: { id: number; name: string }[];
  availability: WorkerAvailability;
  reputation: Reputation;
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
  /** `null` si no existe (o el id no es válido). */
  getPublicWorkerProfile(id: string): Promise<PublicWorkerProfile | null>;
};
