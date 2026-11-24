'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isPublicPath } from '@/components/auth/session-guard';
import { notificationsApi } from '@/lib/api';
import { ApiError } from '@/lib/api/http';
import { ROUTES } from '@/lib/routes';
import { useCurrentUser } from '@/lib/session/use-current-user';

export const inboxChanged = 'red:notifications-read';

export function NotificationBell() {
  const path = usePathname();
  return isPublicPath(path) ? null : <SessionBell />;
}
function SessionBell() {
  const session = useCurrentUser();
  return session.status === 'ready' && session.user ? <UnreadBell /> : null;
}
function UnreadBell() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let current = 0;
    let timer: ReturnType<typeof setTimeout>;
    let nextAllowed = 0;
    function refresh() {
      clearTimeout(timer);
      const version = ++current;
      if (document.visibilityState !== 'visible') return;
      if (Date.now() < nextAllowed) {
        timer = setTimeout(refresh, nextAllowed - Date.now());
        return;
      }
      notificationsApi
        .count()
        .then(
          ({ unread }) => {
            if (version === current) setCount(unread);
          },
          (error: unknown) => {
            if (version === current && error instanceof ApiError && error.status === 429)
              nextAllowed = Date.now() + error.retryAfter * 1000;
          },
        )
        .finally(() => {
          if (version === current)
            timer = setTimeout(refresh, Math.max(30000, nextAllowed - Date.now()));
        });
    }
    refresh();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener(inboxChanged, refresh);
    return () => {
      current++;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener(inboxChanged, refresh);
    };
  }, []);
  return (
    <Link
      href={ROUTES.notifications}
      aria-label={count ? `Notificaciones, ${count} sin leer` : 'Notificaciones'}
      className="relative flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-white text-brand-dark focus-visible:outline-3 focus-visible:outline-brand"
    >
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 10h18c0-2-3-3-3-10ZM10 21a2 2 0 0 0 4 0" />
      </svg>
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 rounded-full bg-brand px-1.5 text-xs font-bold text-white"
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
