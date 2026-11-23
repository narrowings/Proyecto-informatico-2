/**
 * Reputación (HU-046) que traen los perfiles públicos, la lista de interesados
 * y `GET /ratings/mine`. Los promedios son `null` sin calificaciones.
 */
export type Reputation = {
  average: number | null;
  fulfillment: number | null;
  punctuality: number | null;
  communication: number | null;
  quality: number | null;
  ratingsCount: number;
  completedJobs: number;
  /** HU-029 CA3: mostrar "Nuevo en la plataforma". */
  isNew: boolean;
  /** Hasta 5, sin el nombre de quien calificó. */
  recentComments: { text: string | null; date: string | null }[];
};

export const REPUTATION_DIMENSIONS = [
  { key: 'fulfillment', label: 'Cumplimiento' },
  { key: 'punctuality', label: 'Puntualidad' },
  { key: 'communication', label: 'Comunicación' },
  { key: 'quality', label: 'Calidad' },
] as const;

export type ReputationDimension = (typeof REPUTATION_DIMENSIONS)[number]['key'];
