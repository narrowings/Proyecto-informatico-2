/**
 * Contrato provisional de la sesión actual. Debe reemplazarse por el cliente
 * generado de @red/contracts cuando exista el contrato de HU-021 (sesiones).
 */

export type CurrentUser = {
  id: string;
  name: string;
  /** Una misma cuenta puede tener perfil de trabajador y de publicador (HU-022 CA4). */
  hasWorkerProfile: boolean;
  hasPublisherProfile: boolean;
};

export type SessionApi = {
  /** Usuario con sesión iniciada, o `null` si no hay sesión. */
  getCurrentUser(): Promise<CurrentUser | null>;
};
