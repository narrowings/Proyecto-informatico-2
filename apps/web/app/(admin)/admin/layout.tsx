import Link from 'next/link';
import type { ReactNode } from 'react';
import { RequireAdmin } from '@/components/admin/require-admin';
import { AppSessionGuard } from '@/components/auth/session-guard';
import { LogoutButton } from '@/components/auth/logout-button';
import { ROUTES } from '@/lib/routes';

const links = [
  ['Reportes', '/admin/reportes'],
  ['Usuarios', '/admin/usuarios'],
  ['Categorías', '/admin/categorias'],
  ['Reglas laborales', '/admin/reglas-laborales'],
  ['Auditoría', '/admin/auditoria'],
];

/** Panel de administración (HU-012). Desde aquí se vuelve a la aplicación o se cierra la sesión. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAdmin>
      <AppSessionGuard />
      <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-5 py-6">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={ROUTES.work}
              className="min-h-11 rounded-field py-2 font-bold text-brand underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-brand"
            >
              ← Volver a la aplicación
            </Link>
            <div className="w-full sm:w-auto">
              <LogoutButton />
            </div>
          </div>
          <h1 className="font-display text-3xl font-bold">Panel de administración</h1>
          <nav aria-label="Administración" className="flex flex-wrap gap-2">
            {links.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-full border border-line px-3 py-2 text-sm font-bold"
              >
                {label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </main>
    </RequireAdmin>
  );
}
