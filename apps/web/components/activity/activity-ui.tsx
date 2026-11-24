'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ApiError } from '@/lib/api/http';
import type { Page } from '@/lib/api';
import { ROUTES } from '@/lib/routes';

export const card =
  'flex min-w-0 flex-col gap-2 rounded-[20px] border border-line bg-white p-4 break-words';
export const heading = 'font-display text-3xl font-bold tracking-tight';
export const linkStyle =
  'inline-flex min-h-11 items-center rounded-field font-bold text-brand-dark underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-brand';
export const labels = {
  RECEIVED: 'Recibida',
  IN_REVIEW: 'En revisión',
  INTERVIEW: 'Entrevista',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  WITHDRAWN: 'Retirada',
  ACTIVE: 'Activa',
  PAUSED: 'Pausada',
  CLOSED: 'Cerrada',
  EXPIRED: 'Vencida',
  CANCELLED: 'Cancelada',
  PENDING: 'Pendiente',
  SCHEDULED: 'Programado',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  FORMAL_JOB: 'Vacante formal',
  QUICK_JOB: 'Trabajo rápido',
  TASK: 'Tarea',
  PROJECT: 'Proyecto',
  SERVICE: 'Servicio',
  ONSITE: 'Presencial',
  REMOTE: 'Remota',
  HYBRID: 'Híbrida',
  FULL_TIME: 'Tiempo completo',
  PART_TIME: 'Medio tiempo',
  SHIFTS: 'Por turnos',
  FLEXIBLE: 'Flexible',
};
export const jobLabel = (status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') =>
  status === 'CANCELLED' ? 'Cancelado' : labels[status];
export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));
export const pesos = (amount: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);

export function ActivityScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <Link className={linkStyle} href={ROUTES.activity}>
        Volver a Mi actividad
      </Link>
      <h1 className={heading}>{title}</h1>
      {children}
    </section>
  );
}

export function Problem({ error, retry }: { error: unknown; retry?: () => void }) {
  const router = useRouter();
  const api = error instanceof ApiError ? error : undefined;
  const destination =
    api?.status === 401
      ? ROUTES.login
      : (
          {
            EMAIL_NOT_CONFIRMED: ROUTES.registerPending,
            WORKER_PROFILE_REQUIRED: ROUTES.workerProfile,
            PUBLISHER_PROFILE_REQUIRED: ROUTES.publisherProfile,
          } as Record<string, string>
        )[api?.problem.code ?? ''];
  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);
  const seconds = api?.status === 429 ? api.retryAfter : 0;
  const [waiting, setWaiting] = useState(seconds > 0);
  useEffect(() => {
    setWaiting(seconds > 0);
    if (seconds > 0) {
      const timer = setTimeout(() => setWaiting(false), seconds * 1000);
      return () => clearTimeout(timer);
    }
  }, [seconds, error]);
  return (
    <div className="flex flex-col gap-2">
      <Alert role="alert" tone="danger">
        {api?.status === 429
          ? `Has realizado varias solicitudes. Inténtalo en ${seconds || 'unos'} segundos.`
          : (api?.problem.message ?? 'No pudimos completar la solicitud. Inténtalo de nuevo.')}
      </Alert>
      {retry && (
        <Button variant="secondary" disabled={waiting} onClick={retry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

export function Resource<T>({
  load,
  children,
}: {
  load: () => Promise<T>;
  children: (data: T, reload: () => void) => ReactNode;
}) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<
    | { load: typeof load; version: number; data: T }
    | { load: typeof load; version: number; error: unknown }
  >();
  const reload = () => setVersion((v) => v + 1);
  useEffect(() => {
    let active = true;
    load().then(
      (data) => {
        if (active) setResult({ load, version, data });
      },
      (error) => {
        if (active) setResult({ load, version, error });
      },
    );
    return () => {
      active = false;
    };
  }, [load, version]);
  if (!result || result.load !== load || result.version !== version)
    return <p role="status">Cargando…</p>;
  if ('error' in result) return <Problem error={result.error} retry={reload} />;
  return children(result.data, reload);
}

export function useAction() {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [retryAt, setRetryAt] = useState(0);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setTimeout(() => setRetryAt(0), Math.max(0, retryAt - Date.now()));
    return () => clearTimeout(timer);
  }, [retryAt]);
  async function run(action: () => Promise<void>) {
    if (locked.current || Date.now() < retryAt) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (failure) {
      setError(failure);
      if (failure instanceof ApiError && failure.status === 429 && failure.retryAfter > 0)
        setRetryAt(Date.now() + failure.retryAfter * 1000);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const fieldErrors = error instanceof ApiError ? error.problem.errors : undefined;
  return { run, busy: busy || retryAt > 0, error, fieldErrors };
}

export function PagedList<T extends { id: string }>({
  data,
  empty,
  changePage,
  children,
}: {
  data: Page<T>;
  empty: ReactNode;
  changePage: (page: number) => void;
  children: (item: T) => ReactNode;
}) {
  return (
    <>
      {data.items.length ? (
        <ul className="flex flex-col gap-3">
          {data.items.map((item) => (
            <li key={item.id} className={card}>
              {children(item)}
            </li>
          ))}
        </ul>
      ) : (
        <p className={card}>{empty}</p>
      )}
      {(data.page > 1 || data.page * data.pageSize < data.total) && (
        <nav aria-label="Paginación" className="flex flex-col gap-2">
          <p>Página {data.page}</p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={data.page <= 1}
              onClick={() => changePage(data.page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              disabled={data.page * data.pageSize >= data.total}
              onClick={() => changePage(data.page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </nav>
      )}
    </>
  );
}
