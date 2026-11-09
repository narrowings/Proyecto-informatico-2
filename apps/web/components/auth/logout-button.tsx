'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api';
import { ROUTES } from '@/lib/routes';

/** Botón "Cerrar sesión" (HU-021 CA5): cierra la sesión y pide iniciarla de nuevo. */
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function logout() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      await authApi.logout();
      router.replace(ROUTES.login);
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {failed ? (
        <Alert tone="danger" role="alert">
          No pudimos cerrar tu sesión. Inténtalo de nuevo.
        </Alert>
      ) : null}
      <Button variant="secondary" aria-disabled={pending} onClick={logout}>
        {pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </Button>
    </div>
  );
}
