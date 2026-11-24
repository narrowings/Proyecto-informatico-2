export type ReportTargetType = 'OPPORTUNITY' | 'USER';
export type ReportProfileKind = 'PUBLISHER' | 'WORKER';
export type ReportReason = 'FRAUD' | 'INAPPROPRIATE' | 'SPAM' | 'OTHER';
export type CreateReport = {
  targetType: ReportTargetType;
  targetId: string;
  profileKind?: ReportProfileKind;
  reason: ReportReason;
  description?: string;
};

/** Resultado de reportar (HU-019). Los errores esperados llegan como estado, no como excepción. */
export type CreateReportResult =
  | { status: 'reported'; message: string }
  | { status: 'already_reported' }
  | { status: 'cannot_report_self' }
  | { status: 'not_found' }
  | { status: 'rate_limited' }
  | { status: 'invalid'; errors: Record<string, string[]> };

export type ReportsApi = { create(input: CreateReport): Promise<CreateReportResult> };
