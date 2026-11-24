export type AdminPage<T> = { items: T[]; total: number; page: number; pageSize: number };
export type AccountStatus = 'PENDING_CONFIRMATION' | 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
export type ReportStatus = 'PENDING' | 'ACTIONED' | 'DISMISSED';
export type ModerationTargetType = 'OPPORTUNITY' | 'USER';
export type AdminCategory = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  opportunitiesCount?: number;
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
  title?: string;
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
export type ReasonResult =
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
export type AdminApi = {
  reports(query: URLSearchParams): Promise<AdminPage<ReportGroup>>;
  users(query: URLSearchParams): Promise<AdminPage<AdminUser>>;
  audit(query: URLSearchParams): Promise<AdminPage<AuditLog>>;
  categories(): Promise<AdminCategory[]>;
  rules(): Promise<LaborWarningRule[]>;
  moderate(path: string, reason: string): Promise<ReasonResult>;
};
