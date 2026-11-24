'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { notificationsApi, type InboxPage, type InboxItem } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { heading, Resource, Problem, useAction } from '@/components/activity/activity-ui';
import { inboxChanged } from './notification-bell';

const firstPage = () => notificationsApi.list(1);
function relativeDate(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  if (minutes < 1440) return `Hace ${Math.floor(minutes / 60)} h`;
  return formatDate(iso);
}
function internal(link: string | null) {
  if (!link?.startsWith('/') || link.startsWith('//') || link.includes('\\')) return false;
  return new URL(link, window.location.origin).origin === window.location.origin;
}
export function NotificationInbox() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className={heading}>Notificaciones</h1>
      <Resource load={firstPage}>{(data) => <Inbox initial={data} />}</Resource>
    </section>
  );
}
function Inbox({ initial }: { initial: InboxPage }) {
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [unread, setUnread] = useState(initial.unread);
  const [page, setPage] = useState(initial.page);
  const [total, setTotal] = useState(initial.total);
  const { run, busy, error } = useAction();
  async function more() {
    const next = await notificationsApi.list(page + 1);
    setItems((previous) => {
      const ids = new Set(previous.map((i) => i.id));
      return [...previous, ...next.items.filter((i) => !ids.has(i.id))];
    });
    setPage(next.page);
    setTotal(next.total);
    setUnread(next.unread);
  }
  async function open(item: InboxItem) {
    const { link } = await notificationsApi.read(item.id);
    setItems((previous) => previous.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    if (!item.read) setUnread((n) => Math.max(n - 1, 0));
    window.dispatchEvent(new Event(inboxChanged));
    if (link && internal(link)) router.push(link);
  }
  async function markAll() {
    await notificationsApi.readAll();
    setItems((previous) => previous.map((i) => ({ ...i, read: true })));
    setUnread(0);
    window.dispatchEvent(new Event(inboxChanged));
  }
  return (
    <>
      {items.length > 0 ? (
        <>
          <Button variant="secondary" disabled={busy || unread === 0} onClick={() => run(markAll)}>
            Marcar todas como leídas
          </Button>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => open(item))}
                  className={`flex min-h-11 w-full flex-col gap-1 rounded-field border border-line p-4 text-left break-words focus-visible:outline-3 focus-visible:outline-brand ${item.read ? 'bg-white' : 'bg-brand-soft'}`}
                >
                  <span className="text-xs font-bold text-muted">
                    {item.read ? 'Leída' : 'Sin leer'} ·{' '}
                    <time dateTime={item.createdAt}>{relativeDate(item.createdAt)}</time>
                  </span>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Aún no tienes notificaciones.</p>
      )}
      {page * initial.pageSize < total && (
        <Button variant="secondary" disabled={busy} onClick={() => run(more)}>
          Cargar más
        </Button>
      )}
      {error ? <Problem error={error} /> : null}
    </>
  );
}
