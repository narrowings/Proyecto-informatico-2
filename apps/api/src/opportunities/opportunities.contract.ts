import type { OpportunityStatus, OpportunityType } from '@prisma/client';

// Contrato que el módulo opportunities (HU-003, 023, 024, 025) ofrece a los demás módulos.
// engagements (HU-006, HU-028) programa contra esta interfaz; OpportunitiesService la implementa.
// Cambiarla exige acordarlo en el PR de ambos módulos (docs/backend/modulos-y-contratos.md).

export type OpportunityForEngagement = {
  id: string;
  type: OpportunityType;
  status: OpportunityStatus;
  title: string;
  publisherProfileId: string;
  publisherUserId: string;
  // N de HU-006; null en vacantes formales.
  peopleNeeded: number | null;
  scheduledAt: Date | null;
  durationMinutes: number | null;
  zone: { id: number; name: string };
  // Solo para mostrar a trabajadores con selección aceptada (decisión del PO).
  exactAddress: string | null;
};

export interface OpportunitiesContract {
  // null si no existe.
  getForEngagement(opportunityId: string): Promise<OpportunityForEngagement | null>;

  // RF-05-09: al completar N aceptaciones la oportunidad pasa a CLOSED y sale del feed.
  // Idempotente: si ya está cerrada no hace nada.
  markFilled(opportunityId: string): Promise<void>;

  // RF-05-08: si se libera un cupo (rechazo, vencimiento o cancelación) y la oportunidad se
  // cerró solo por estar llena, vuelve a ACTIVE si su fecha no ha pasado. Idempotente.
  reopenIfFilled(opportunityId: string): Promise<void>;
}
