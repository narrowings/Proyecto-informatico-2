'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import type { CurrentUser } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import { useCurrentUser } from '@/lib/session/use-current-user';

export type RequiredProfile = 'worker' | 'publisher' | 'none';

/** A dónde mandar al usuario si no puede ver la pantalla; `null` si puede verla. */
export function redirectFor(user: CurrentUser | null, required: RequiredProfile): string | null {
  if (!user) return ROUTES.login;
  // HU-022 CA3: la primera vez se completa el perfil correspondiente antes de continuar.
  if (required === 'worker' && !user.hasWorkerProfile)
    return `${ROUTES.workerProfile}?desde=trabajar`;
  if (required === 'publisher' && !user.hasPublisherProfile) return ROUTES.publisherProfile;
  return null;
}

/**
 * Protege una pantalla de intención: exige sesión y, según la intención, el
 * perfil de trabajador o de publicador. Se aplica en el destino para cubrir
 * también los enlaces directos y el menú principal.
 */
export function RequireProfile({
  profile,
  children,
}: {
  profile: RequiredProfile;
  children: ReactNode;
}) {
  const router = useRouter();
  const session = useCurrentUser();
  const target = session.status === 'ready' ? redirectFor(session.user, profile) : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (session.status === 'error') {
    return (
      <Alert tone="danger" role="alert">
        No pudimos cargar tu sesión. Recarga la página para intentarlo de nuevo.
      </Alert>
    );
  }

  if (session.status === 'loading' || target) {
    return (
      <p role="status" className="text-[15px] text-muted">
        Cargando…
      </p>
    );
  }

  return children;
}
