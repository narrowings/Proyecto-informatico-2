/**
 * Publicaciones (HU-003, HU-025): `POST /v1/opportunities/labor-warnings` y
 * `POST /v1/opportunities`. Contrato provisional hasta que exista el cliente
 * generado de @red/contracts.
 */

/** Tipos que se publican con el formulario de necesidad (HU-003). */
export type TaskType = 'TASK' | 'QUICK_JOB' | 'PROJECT' | 'SERVICE';

/** La vacante formal tiene su propio formulario (HU-024). */
export type OpportunityType = TaskType | 'FORMAL_JOB';

export type NewTaskOpportunity = {
  type: TaskType;
  /** Actividad: 5 a 120 caracteres. */
  title: string;
  /** 20 a 3000 caracteres. */
  description: string;
  categoryId: number;
  /** Solo la zona de Cali: la dirección exacta nunca se pide al publicar (HU-003 CA4). */
  zoneId: number;
  /** 1 a 50. */
  peopleNeeded: number;
  /** Pesos colombianos enteros, mayor que cero. */
  paymentCop: number;
  /** ISO 8601 en UTC, en el futuro. */
  scheduledAt: string;
  /** Al menos 15 minutos. */
  durationMinutes: number;
  /** Opcional, hasta 1000 caracteres. */
  conditions?: string;
};

/** Texto aprobado por asesoría jurídica: se muestra tal cual llega (HU-003 CA2). */
export type LaborWarning = { code: string; message: string };

export type PublishResult =
  | { ok: true; id: string }
  /** El API exige confirmar que se leyó la advertencia (409 LABOR_WARNING_REQUIRED). */
  | { ok: false; reason: 'labor_warning_required'; warnings: LaborWarning[] };

export type OpportunitiesApi = {
  /** Advertencias de relación laboral para esas condiciones; lista vacía si no aplica. */
  previewLaborWarnings(input: NewTaskOpportunity): Promise<LaborWarning[]>;
  /** `acknowledgeLaborWarning` solo debe ser `true` después de mostrar la advertencia. */
  publish(input: NewTaskOpportunity, acknowledgeLaborWarning: boolean): Promise<PublishResult>;
  list(query: OpportunityQuery): Promise<OpportunityPage>;
  get(id: string): Promise<OpportunityResult>;
  apply(id: string, message?: string): Promise<ApplicationResult>;
  applicationStatus(ids: string[]): Promise<Record<string, boolean>>;
};

export type OpportunityQuery = {
  mode: 'tasks' | 'formal';
  q?: string;
  type?: TaskType;
  categoryId?: number;
  zoneId?: number;
  modality?: 'ONSITE' | 'REMOTE' | 'HYBRID';
  salaryMin?: number;
  paymentMin?: number;
  page?: number;
  pageSize?: number;
};
export type Opportunity = {
  id: string;
  type: OpportunityType;
  status: string;
  title: string;
  description: string;
  category: { id: number; name: string };
  zone: { id: number; name: string };
  paymentCop: number | null;
  salaryMinCop: number | null;
  salaryMaxCop: number | null;
  modality: 'ONSITE' | 'REMOTE' | 'HYBRID' | null;
  schedule: string | null;
  scheduledAt: string | null;
  closesAt: string | null;
  publisher: { id: string; displayName: string; photoUrl: string | null } | null;
};
export type OpportunityPage = {
  items: Opportunity[];
  total: number;
  page: number;
  pageSize: number;
};
export type OpportunityResult =
  { status: 'found'; opportunity: Opportunity } | { status: 'not_found' };
export type ApplicationResult =
  | { status: 'applied' }
  | {
      status:
        | 'already_applied'
        | 'closed'
        | 'no_worker_profile'
        | 'not_found'
        | 'rate_limited'
        | 'email_not_confirmed'
        | 'own_opportunity';
    }
  | { status: 'invalid'; errors: Record<string, string[]> };
