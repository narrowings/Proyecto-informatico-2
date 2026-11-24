'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { notificationsApi } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import { useCurrentUser } from '@/lib/session/use-current-user';

export function NotificationBell() {
  const session = useCurrentUser();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (session.status !== 'ready' || !session.user) return;
    let active = true;
    const refresh = () => {
      if (document.visibilityState === 'visible')
        void notificationsApi
          .unreadCount()
          .then(({ unread }) => active && setUnread(unread))
          .catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('red:notifications', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('red:notifications', refresh);
    };
  }, [session.status, session.status === 'ready' ? session.user?.id : undefined]);

  if (session.status !== 'ready' || !session.user) return null;
  return (
    <Link
      href={ROUTES.notifications}
      aria-label={`Notificaciones${unread ? `: ${unread} sin leer` : ''}`}
      className="relative flex size-11 items-center justify-center rounded-full text-ink focus-visible:outline-3 focus-visible:outline-brand"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="size-6"
      >
        <path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </svg>
      {unread ? (
        <span className="absolute top-0.5 right-0.5 min-w-5 rounded-full bg-danger px-1 text-center text-xs font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
