import type { NotificationType } from '@prisma/client';

// Contrato del módulo notifications (RF-07-06, RF-07-07). Cada módulo solo emite el evento;
// notifications decide el texto del correo y guarda la notificación en la bandeja.
// Mientras el módulo no exista, los demás inyectan NOTIFICATIONS con una implementación que no hace nada.

export const NOTIFICATIONS = Symbol('NOTIFICATIONS');

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string; // máx. 160
  body: string; // máx. 500, sin datos personales de la otra parte
  link?: string; // ruta del frontend, p. ej. /mi-actividad
  data?: Record<string, string | number | boolean | null>;
};

export interface NotificationsContract {
  // No debe lanzar errores hacia quien llama: una notificación fallida nunca deshace la acción.
  notify(input: NotifyInput): Promise<void>;
  notifyMany(inputs: NotifyInput[]): Promise<void>;
}
