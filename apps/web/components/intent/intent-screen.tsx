'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Logo } from '@/components/logo';
import { Alert } from '@/components/ui/alert';
import { ROUTES } from '@/lib/routes';
import { useCurrentUser } from '@/lib/session/use-current-user';
import { IntentOptions } from './intent-options';

const STEPS = ['Publica', 'Descubre', 'Conecta', 'Trabaja'];

/**
 * Pantalla de selección de intención (HU-022). Se llega aquí después de iniciar
 * sesión (HU-021 CA1) o de confirmar el correo (HU-001 CA2). Sin sesión, se
 * redirige al inicio de sesión.
 */
export function IntentScreen() {
  const router = useRouter();
  const session = useCurrentUser();
  const noSession = session.status === 'ready' && session.user === null;

  useEffect(() => {
    if (noSession) router.replace(ROUTES.login);
  }, [noSession, router]);

  const firstName = session.status === 'ready' ? session.user?.name.split(' ')[0] : undefined;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-5 pt-8 pb-6">
      <header>
        <Logo />
      </header>

      <main className="flex flex-1 flex-col gap-5">
        <div className="mt-2 flex flex-col gap-2">
          <h1 className="font-display text-4xl leading-none font-bold tracking-tight">
            ¿Qué quieres hacer hoy?
          </h1>
          <p className="text-[15px] leading-snug text-muted">
            {firstName ? `Hola, ${firstName}. ` : ''}Elige una intención y te mostramos la
            experiencia que mejor encaja.
          </p>
        </div>

        {session.status === 'error' ? (
          <Alert tone="danger" role="alert">
            No pudimos cargar tu sesión. Recarga la página para intentarlo de nuevo.
          </Alert>
        ) : null}

        <IntentOptions />

        <section aria-labelledby="como-funciona" className="mt-auto flex flex-col gap-2.5">
          <h2 id="como-funciona" className="text-xs font-bold tracking-widest text-muted uppercase">
            Cómo funciona
          </h2>
          <ol className="flex gap-2">
            {STEPS.map((step, index) => (
              <li
                key={step}
                className="flex flex-1 flex-col gap-1.5 rounded-field border border-line bg-white px-2.5 py-3"
              >
                <span
                  aria-hidden="true"
                  className="flex size-6 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-brand"
                >
                  {index + 1}
                </span>
                <span className="text-[13px] font-bold">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
