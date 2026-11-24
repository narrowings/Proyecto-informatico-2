import Link from 'next/link';
import type { ReactNode } from 'react';
import { RequireAdmin } from '@/components/admin/require-admin';
const links = [
  ['Reportes', '/admin/reportes'],
  ['Usuarios', '/admin/usuarios'],
  ['Categorías', '/admin/categorias'],
  ['Reglas laborales', '/admin/reglas-laborales'],
  ['Auditoría', '/admin/auditoria'],
];
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAdmin>
      <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-5 py-6">
        <header>
          <h1 className="font-display text-3xl font-bold">Panel de administración</h1>
          <nav aria-label="Administración" className="mt-4 flex flex-wrap gap-2">
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
