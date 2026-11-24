'use client';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { ROUTES } from '@/lib/routes';
import { useCurrentUser } from '@/lib/session/use-current-user';
export function RequireAdmin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useCurrentUser();
  useEffect(() => {
    if (session.status === 'ready' && !session.user) router.replace(ROUTES.login);
  }, [router, session]);
  if (session.status === 'loading') return <p role="status">Cargando…</p>;
  if (session.status === 'error') return <Alert tone="danger">No pudimos cargar tu sesión.</Alert>;
  if (!session.user?.isAdmin)
    return <Alert tone="danger">Esta sección es solo para administradores.</Alert>;
  return children;
}
