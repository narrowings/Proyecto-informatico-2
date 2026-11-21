import type { ApplicationStatus } from '@prisma/client';

// Contrato que el módulo applications (HU-005, HU-024 CA2) ofrece a los demás módulos.
// engagements (HU-006) programa contra esta interfaz; ApplicationsService la implementa.

// Token de inyección: @Inject(APPLICATIONS) private readonly x: ApplicationsContract.
export const APPLICATIONS = Symbol('APPLICATIONS');

export type ApplicationWithParties = {
  id: string;
  status: ApplicationStatus;
  opportunityId: string;
  workerProfileId: string;
  workerUserId: string;
  createdAt: Date;
};

// RF-05-06: lo que ve el publicador de cada interesado. Sin correo ni teléfono (RF-02-07).
export type ApplicantSummary = ApplicationWithParties & {
  worker: {
    displayName: string;
    // null si el trabajador eligió no mostrar su foto (HU-030 CA4).
    photoUrl: string | null;
    availability: 'AVAILABLE' | 'UNAVAILABLE';
    zone: { id: number; name: string };
    skills: string[];
  };
};

export interface ApplicationsContract {
  // null si no existe.
  getWithParties(applicationId: string): Promise<ApplicationWithParties | null>;

  // Interesados de una oportunidad, del más antiguo al más reciente. No incluye WITHDRAWN.
  listForOpportunity(opportunityId: string): Promise<ApplicantSummary[]>;

  // Perfil de trabajador del usuario y los ids de sus postulaciones (cualquier estado), para que
  // engagements filtre "Mis selecciones" y "Mis trabajos" en la base. workerProfileId es null si el
  // usuario no tiene perfil de trabajador.
  listIdsForWorkerUser(
    userId: string,
  ): Promise<{ workerProfileId: string | null; applicationIds: string[] }>;

  // RF-03-07: contadores de "Mis publicaciones". applicants no cuenta las retiradas; accepted son
  // las personas que aceptaron la selección o fueron aceptadas en la vacante.
  countForOpportunities(
    opportunityIds: string[],
  ): Promise<Map<string, { applicants: number; accepted: number }>>;

  // engagements marca ACCEPTED cuando el trabajador acepta la selección y REJECTED a los no
  // seleccionados al llenarse los cupos (RF-05-09). No notifica: eso lo hace quien llama.
  setStatus(applicationId: string, status: ApplicationStatus): Promise<void>;
}
