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

/** Contrato provisional de HU-008, alineado con PublisherProfile de T-01. */
export type CreatePublisherProfileRequest = {
  displayName: string;
  photoUrl: string;
  description: string;
} & (
  | { kind: 'PERSON' }
  | { kind: 'COMPANY'; nit: string; nitCheckDigit: string; contactName: string; sector: string }
);

export type PublisherProfile = CreatePublisherProfileRequest & { id: string; isVerified: boolean };

/** Lista explícita de datos públicos. Excluye NIT, representante y contacto. */
export type PublicPublisherProfile = Pick<
  PublisherProfile,
  'id' | 'kind' | 'displayName' | 'photoUrl' | 'description' | 'isVerified'
>;

export type CreatePublisherProfileResult =
  { ok: true; profile: PublisherProfile } | { ok: false; reason: 'already_exists' };

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
