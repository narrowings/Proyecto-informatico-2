export type AdminPage<T> = { items: T[]; total: number; page: number; pageSize: number };
export type AccountStatus = 'PENDING_CONFIRMATION' | 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
export type ReportStatus = 'PENDING' | 'ACTIONED' | 'DISMISSED';
export type ModerationTargetType = 'OPPORTUNITY' | 'USER';
export type AdminCategory = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  /** Número de oportunidades que usan la categoría. */
  opportunities: number;
};
export type LaborWarningRule = {
  code: 'FULL_DAY' | 'LONG_TERM' | 'SUBORDINATION_TERMS';
  message: string;
  params: Record<string, unknown>;
  isActive: boolean;
  updatedAt: string;
};
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  role: 'USER' | 'ADMIN';
  createdAt: string;
};
export type ReportTarget = {
  id?: string;
  title?: string;
  role?: 'USER' | 'ADMIN';
  name?: string;
  email?: string;
  status?: AccountStatus;
  hiddenAt?: string | null;
  hiddenReason?: string | null;
} | null;
export type ReportGroup = {
  targetType: ModerationTargetType;
  targetId: string;
  reportCount: number;
  reasons: Record<string, number>;
  firstReportedAt: string;
  lastReportedAt: string;
  target: ReportTarget;
};
export type AuditLog = {
  id: string;
  action: string;
  actorUserId: string | null;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  ip: string | null;
  createdAt: string;
};
export type ReportDetail = {
  targetType: ModerationTargetType;
  targetId: string;
  target: ReportTarget;
  reportCount: number;
  reports: {
    reason: string;
    description: string | null;
    createdAt: string;
    status: ReportStatus;
  }[];
};

/** Resultado de una acción del panel. Los errores esperados llegan como estado, no como excepción. */
export type AdminResult =
  | { status: 'ok' }
  | {
      status:
        | 'already_hidden'
        | 'not_hidden'
        | 'invalid_account_state'
        | 'cannot_moderate_admin'
        | 'category_exists'
        | 'not_found'
        | 'forbidden';
    }
  | { status: 'invalid'; errors: Record<string, string[]> };
export type ModerationAction =
  | { kind: 'hide' | 'unhide'; opportunityId: string }
  | { kind: 'suspend' | 'block' | 'reactivate'; userId: string }
  | { kind: 'dismiss'; targetType: ModerationTargetType; targetId: string };

export type CategoryInput = { name?: string; description?: string | null; isActive?: boolean };
export type RuleInput = { message?: string; isActive?: boolean; params?: Record<string, unknown> };

export type AdminApi = {
  reports(query: URLSearchParams): Promise<AdminPage<ReportGroup>>;
  reportDetail(targetType: ModerationTargetType, targetId: string): Promise<ReportDetail>;
  users(query: URLSearchParams): Promise<AdminPage<AdminUser>>;
  audit(query: URLSearchParams): Promise<AdminPage<AuditLog>>;
  categories(): Promise<AdminCategory[]>;
  rules(): Promise<LaborWarningRule[]>;
  moderate(action: ModerationAction, reason: string): Promise<AdminResult>;
  createCategory(input: CategoryInput): Promise<AdminResult>;
  updateCategory(id: number, input: CategoryInput): Promise<AdminResult>;
  updateRule(code: LaborWarningRule['code'], input: RuleInput): Promise<AdminResult>;
};

/** Ruta de la API de cada acción de moderación (HU-012). */
export const moderationPath = (action: ModerationAction) => {
  const id = (value: string) => encodeURIComponent(value);
  switch (action.kind) {
    case 'hide':
    case 'unhide':
      return `/admin/opportunities/${id(action.opportunityId)}/${action.kind}`;
    case 'dismiss':
      return `/admin/reports/${action.targetType}/${id(action.targetId)}/dismiss`;
    default:
      return `/admin/users/${id(action.userId)}/${action.kind}`;
  }
};

/** Texto para el administrador según el resultado de una acción. */
export const adminResultMessage = (result: AdminResult): string | null => {
  switch (result.status) {
    case 'ok':
      return null;
    case 'already_hidden':
      return 'La publicación ya estaba oculta.';
    case 'not_hidden':
      return 'La publicación no está oculta.';
    case 'invalid_account_state':
      return 'La cuenta no está en un estado válido para esta acción. Recarga la lista.';
    case 'cannot_moderate_admin':
      return 'No puedes moderar una cuenta administradora.';
    case 'category_exists':
      return 'Ya existe una categoría con ese nombre.';
    case 'not_found':
      return 'El elemento ya no existe.';
    case 'forbidden':
      return 'Esta sección es solo para administradores.';
    case 'invalid':
      return Object.values(result.errors).flat()[0] ?? 'Revisa los datos.';
  }
};
