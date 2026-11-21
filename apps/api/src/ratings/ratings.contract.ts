import type { RatedRole } from '@prisma/client';

// Contrato que ratings (HU-046) ofrece a los perfiles públicos. Se resuelve de forma perezosa con
// ModuleRef porque ratings depende (vía engagements) de opportunities, que depende de profiles.
export const REPUTATION = Symbol('REPUTATION');

export type ReputationSummaryView = {
  average: number | null;
  fulfillment: number | null;
  punctuality: number | null;
  communication: number | null;
  quality: number | null;
  ratingsCount: number;
  completedJobs: number;
  // HU-029 CA3: "Nuevo en la plataforma".
  isNew: boolean;
  recentComments: { text: string | null; date: Date | null }[];
};

export interface ReputationContract {
  getSummary(userId: string, role: RatedRole): Promise<ReputationSummaryView>;
}

// Mientras ratings no esté disponible (p. ej. en pruebas), los perfiles muestran "Nuevo".
export const EMPTY_REPUTATION: ReputationSummaryView = {
  average: null,
  fulfillment: null,
  punctuality: null,
  communication: null,
  quality: null,
  ratingsCount: 0,
  completedJobs: 0,
  isNew: true,
  recentComments: [],
};
