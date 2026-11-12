'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api';
import { ROUTES } from '@/lib/routes';

type State = 'checking' | 'expired' | 'error';

/**
 * Confirmación de correo (HU-001 CA2). Con el enlace válido la cuenta pasa a
 * "Activa" y se lleva al usuario a la selección de intención (pantalla Inicio,
 * HU-022). Con el enlace vencido se ofrece solicitar uno nuevo.
 */
export function ConfirmEmail() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<State>('checking');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendFailed, setResendFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // El token es de un solo uso: evita confirmar dos veces (StrictMode en desarrollo).
    if (started.current) return;
    started.current = true;
    authApi
      .confirmEmail(token)
      .then((result) => {
        if (result.status === 'active') {
          router.replace(ROUTES.home);
        } else {
          setState('expired');
        }
      })
      .catch(() => setState('error'));
  }, [token, router]);

  async function requestNewLink() {
    if (resending) return;
    setResending(true);
    setResendFailed(false);
    try {
      await authApi.requestNewConfirmationLink(token);
      setResent(true);
    } catch {
      setResendFailed(true);
    } finally {
      setResending(false);
    }
  }

  if (state === 'checking') {
    return (
      <div className="flex flex-col gap-2" role="status">
        <h1 className="font-display text-3xl leading-tight font-bold">Confirmando tu correo…</h1>
        <p className="text-[15px] text-muted">Un momento, estamos activando tu cuenta.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight font-bold">
          {state === 'expired' ? 'El enlace venció' : 'No pudimos confirmar tu correo'}
        </h1>
        <p className="text-[15px] text-muted">
          {state === 'expired'
            ? 'El enlace de confirmación ya no es válido. Solicita uno nuevo para activar tu cuenta.'
            : 'Ocurrió un problema al confirmar tu cuenta. Inténtalo de nuevo más tarde.'}
        </p>
      </div>

      {resent ? (
        <Alert tone="success" role="status">
          Te enviamos un nuevo enlace de confirmación. Revisa tu correo.
        </Alert>
      ) : null}
      {resendFailed ? (
        <Alert tone="danger" role="alert">
          No pudimos enviar el enlace. Inténtalo de nuevo.
        </Alert>
      ) : null}

      {state === 'expired' ? (
        <Button type="button" aria-disabled={resending} onClick={requestNewLink}>
          {resending ? 'Enviando…' : 'Solicitar nuevo enlace'}
        </Button>
      ) : null}
    </div>
  );
}
