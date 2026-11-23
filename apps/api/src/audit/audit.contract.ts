import type { AuditAction, Prisma } from '@prisma/client';

// Contrato del módulo audit (HU-038). Los demás módulos registran eventos críticos con AUDIT.record;
// nadie lee ni escribe la tabla audit_logs directamente (y la base rechaza editarla o borrarla).

export const AUDIT = Symbol('AUDIT');

export type AuditInput = {
  // Quién lo hizo; null para eventos del sistema.
  actorUserId: string | null;
  action: AuditAction;
  // Sobre qué: 'user', 'opportunity', 'category', 'report', 'selection', 'labor_rule'…
  targetType?: string;
  targetId?: string;
  // Motivo obligatorio en ocultar, suspender y bloquear (RN-22).
  reason?: string;
  // IP real del cliente (trust proxy), cuando la acción viene de una petición.
  ip?: string;
  // Detalle sin datos personales de terceros: estados antes y después, versiones, nombres de categoría.
  data?: Record<string, string | number | boolean | null>;
};

export interface AuditContract {
  // Lanza si no se pudo guardar: una acción sensible no debe quedar sin rastro. Con `tx`, el registro
  // entra en la misma transacción que la acción (todo o nada).
  record(input: AuditInput, tx?: Prisma.TransactionClient): Promise<void>;
}
