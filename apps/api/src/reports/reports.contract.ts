import type { ReportTargetType } from '@prisma/client';

// Contrato del módulo reports (HU-019) para los demás módulos. opportunities lo usa para sacar del
// feed lo que el propio usuario reportó (HU-019 CA1, RF-04-06). Se resuelve con ModuleRef al usarlo,
// porque reports depende de opportunities.

export const REPORTS = Symbol('REPORTS');

export interface ReportsContract {
  // Ids de los elementos de ese tipo que el usuario ya reportó (cualquier estado del reporte).
  listReportedTargetIds(userId: string, targetType: ReportTargetType): Promise<string[]>;
}
