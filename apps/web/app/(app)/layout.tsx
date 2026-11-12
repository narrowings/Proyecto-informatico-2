import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppNav } from '@/components/app/app-nav';
import { Logo } from '@/components/logo';
import { ROUTES } from '@/lib/routes';

/** Marco de las pantallas con sesión: contenido arriba y menú principal abajo. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-md px-5 pt-6">
        <Link
          href={ROUTES.home}
          aria-label="Ir al inicio"
          className="block rounded-field focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pt-6 pb-8">{children}</main>
      <AppNav />
    </div>
  );
}
