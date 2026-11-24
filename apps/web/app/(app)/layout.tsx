import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppNav } from '@/components/app/app-nav';
import { AppSessionGuard } from '@/components/auth/session-guard';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Logo } from '@/components/logo';
import { ROUTES } from '@/lib/routes';

/** Marco de las pantallas con sesión: contenido arriba y menú principal abajo. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppSessionGuard />
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6">
        <Link
          href={ROUTES.home}
          aria-label="Ir al inicio"
          className="block rounded-field focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <Logo />
        </Link>
        <NotificationBell />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pt-6 pb-8">{children}</main>
      <AppNav />
    </div>
  );
}
