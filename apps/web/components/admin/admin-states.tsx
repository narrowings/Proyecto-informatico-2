import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import type { AdminData } from './use-admin-data';

/** Estados comunes de las pantallas del panel: cargando, error con reintento, vacío y datos. */
export function AdminStates<T>({
  state,
  reload,
  isEmpty,
  empty,
  children,
}: {
  state: AdminData<T>;
  reload: () => void;
  isEmpty: (data: T) => boolean;
  empty: string;
  children: (data: T) => ReactNode;
}) {
  if (state.status === 'loading')
    return (
      <p role="status" className="text-muted">
        Cargando…
      </p>
    );
  if (state.status === 'error')
    return (
      <Alert tone="danger" role="alert">
        No pudimos cargar la información.{' '}
        <button type="button" className="font-bold underline" onClick={reload}>
          Reintentar
        </button>
      </Alert>
    );
  if (isEmpty(state.data)) return <p className="text-muted">{empty}</p>;
  return <>{children(state.data)}</>;
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages === 1) return null;
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 text-sm">
      <button
        type="button"
        className="min-h-11 rounded-field border border-line px-4 font-bold disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Anterior
      </button>
      <span>
        Página {page} de {pages}
      </span>
      <button
        type="button"
        className="min-h-11 rounded-field border border-line px-4 font-bold disabled:opacity-40"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Siguiente
      </button>
    </nav>
  );
}

const STATUS_TEXT = {
  PENDING_CONFIRMATION: ['Sin confirmar', 'bg-info-bg text-info-ink'],
  ACTIVE: ['Activa', 'bg-brand-soft text-brand-dark'],
  SUSPENDED: ['Suspendida', 'bg-warn-bg text-warn-ink'],
  BLOCKED: ['Bloqueada', 'bg-danger-soft text-danger'],
} as const;

export function AccountBadge({ status }: { status: keyof typeof STATUS_TEXT }) {
  const [text, tone] = STATUS_TEXT[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{text}</span>;
}

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
