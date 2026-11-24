import type { Reputation } from './reputation';

/** Las cuatro dimensiones de HU-007, enteros de 1 a 5. */
export type RatingScores = {
  fulfillment: number;
  punctuality: number;
  communication: number;
  quality: number;
};

export type CreateRatingRequest = RatingScores & { comment?: string };

export type RateJobResult =
  /** `published: false` → oculta hasta que la otra parte califique o pasen 7 días (HU-007 CA2). */
  | { status: 'rated'; published: boolean }
  /** HU-007 CA4: una vez por persona y sin edición. */
  | { status: 'already_rated' }
  | { status: 'not_completed' }
  /** No existe o no es una de las partes (el API no distingue a propósito). */
  | { status: 'not_found' }
  | { status: 'invalid'; errors: Record<string, string[]> };

export type ReceivedRating = RatingScores & {
  id: string;
  comment: string | null;
  /** Rol en el que se recibió la calificación. */
  rateeRole: 'WORKER' | 'PUBLISHER';
  jobId: string;
  publishedAt: string;
};

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

/** `GET /ratings/mine`: reputación propia en cada rol y calificaciones recibidas (HU-013 CA3). */
export type MyRatings = {
  worker: Reputation;
  publisher: Reputation;
  ratings: Page<ReceivedRating>;
};

export type RatingsApi = {
  rateJob(jobId: string, rating: CreateRatingRequest): Promise<RateJobResult>;
  getMyRatings(page: number, pageSize?: number): Promise<MyRatings>;
};
