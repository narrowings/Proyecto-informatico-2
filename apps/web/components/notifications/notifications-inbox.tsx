'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { notificationsApi, type NotificationItem, type NotificationsPage } from '@/lib/api';

const relativeDate = (value: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `Hace ${hours} h` : `Hace ${Math.floor(hours / 24)} días`;
};

export function NotificationsInbox() {
  const router = useRouter();
  const [page, setPage] = useState<NotificationsPage>();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const load = (number = 1) =>
    notificationsApi.list(number).then((data) => {
      setPage(data);
      setItems((current) => (number === 1 ? data.items : [...current, ...data.items]));
      setStatus('ready');
    });
  useEffect(() => {
    void load().catch(() => setStatus('error'));
  }, []);
  const refreshBell = () => window.dispatchEvent(new Event('red:notifications'));
  async function read(item: NotificationItem) {
    try {
      const result = item.read ? { link: item.link } : await notificationsApi.markAsRead(item.id);
      if (!item.read) {
        setItems((all) =>
          all.map((current) => (current.id === item.id ? { ...current, read: true } : current)),
        );
        refreshBell();
      }
      if (result.link?.startsWith('/')) router.push(result.link);
    } catch {
      setStatus('error');
    }
  }
  if (status === 'loading')
    return (
      <p role="status" className="text-muted">
        Cargando notificaciones…
      </p>
    );
  if (status === 'error')
    return (
      <Alert tone="danger" role="alert">
        No pudimos cargar las notificaciones.{' '}
        <button
          className="underline"
          onClick={() => {
            setStatus('loading');
            void load().catch(() => setStatus('error'));
          }}
        >
          Reintentar
        </button>
      </Alert>
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Notificaciones</h1>
        <Button
          variant="secondary"
          onClick={() =>
            void notificationsApi.markAllAsRead().then(() => {
              setItems((all) => all.map((item) => ({ ...item, read: true })));
              refreshBell();
            })
          }
        >
          Marcar todas
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-muted">No tienes notificaciones todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                className={`min-h-11 w-full rounded-card border p-4 text-left ${item.read ? 'border-line bg-white' : 'border-brand bg-brand-soft'}`}
                onClick={() => void read(item)}
              >
                <div className="flex justify-between gap-3">
                  <strong>{item.title}</strong>
                  <time className="shrink-0 text-xs text-muted">
                    {relativeDate(item.createdAt)}
                  </time>
                </div>
                <p className="mt-1 text-sm">{item.body}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {page && items.length < page.total ? (
        <Button
          variant="secondary"
          aria-disabled={loadingMore}
          onClick={() => {
            setLoadingMore(true);
            void load(page.page + 1)
              .catch(() => setStatus('error'))
              .finally(() => setLoadingMore(false));
          }}
        >
          {loadingMore ? 'Cargando…' : 'Cargar más'}
        </Button>
      ) : null}
    </div>
  );
}
