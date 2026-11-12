'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authApi } from '@/lib/api';
import { getInactivityTimeoutMs, SESSION_EXPIRED_REASON } from '@/lib/auth/session';
import { ROUTES } from '@/lib/routes';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;

/**
 * Cierra la sesión tras un tiempo sin actividad y lleva a iniciar sesión de nuevo
 * (HU-021 CA5). Debe montarse en el layout de las pantallas con sesión iniciada.
 * No reemplaza la expiración del servidor, que es la que manda.
 */
export function SessionGuard({ timeoutMs = getInactivityTimeoutMs() }: { timeoutMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const expire = async () => {
      try {
        await authApi.logout();
      } catch {
        // Aun si el servidor no responde, el usuario debe volver a iniciar sesión.
      }
      router.replace(`${ROUTES.login}?motivo=${SESSION_EXPIRED_REASON}`);
    };

    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(expire, timeoutMs);
    };

    restart();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, restart, { passive: true });
    }
    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, restart);
    };
  }, [timeoutMs, router]);

  return null;
}
