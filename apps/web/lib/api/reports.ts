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
export type ReportsApi = { create(input: CreateReport): Promise<{ id: string; message: string }> };
