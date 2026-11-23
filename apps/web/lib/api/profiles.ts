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

/** Perfil propio (`GET /profiles/worker/me`): incluye la configuración de privacidad. */
export type OwnWorkerProfile = {
  id: string;
  displayName: string;
  /** Relativa al API; la foto propia se descarga con el token (puede estar oculta). */
  photoUrl: string;
  skills: string[];
  experience: string | null;
  zoneId: number;
  zone: { id: number; name: string };
  categoryIds: number[];
  categories: { id: number; name: string }[];
  availability: WorkerAvailability;
  /** HU-030 CA4: qué datos opcionales se muestran en el perfil público. */
  showPhoto: boolean;
  showExperience: boolean;
};

/** HU-032 y HU-030 CA4: solo los campos que cambian; los demás quedan igual. */
export type UpdateWorkerProfileRequest = Partial<{
  displayName: string;
  skills: string[];
  /** Vacía la borra. */
  experience: string;
  zoneId: number;
  categoryIds: number[];
  availability: WorkerAvailability;
  showPhoto: boolean;
  showExperience: boolean;
}>;

export type UpdateWorkerProfileResult =
  | { ok: true; profile: OwnWorkerProfile }
  /** Errores por campo que devuelve el API (400), ya en español. */
  | { ok: false; errors: Record<string, string[]> };

export type ReplacePhotoResult =
  | { ok: true; profile: OwnWorkerProfile }
  | { ok: false; reason: 'too_large' | 'invalid'; message?: string };

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
  /** `null` si todavía no tiene perfil de trabajador. */
  getOwnWorkerProfile(): Promise<OwnWorkerProfile | null>;
  updateWorkerProfile(changes: UpdateWorkerProfileRequest): Promise<UpdateWorkerProfileResult>;
  replaceWorkerPhoto(photo: File): Promise<ReplacePhotoResult>;
  /** La foto propia aunque esté oculta: un `<img>` directo daría 404. */
  getOwnWorkerPhoto(): Promise<Blob>;
};
