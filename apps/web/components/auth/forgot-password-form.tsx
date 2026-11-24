'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { authApi } from '@/lib/api';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/lib/auth/schemas';
import { ROUTES } from '@/lib/routes';

type Outcome = { kind: 'sent' } | { kind: 'rate_limited'; minutes: number } | { kind: 'error' };

/** HU-018 CA1: el mensaje es el mismo exista o no el correo. */
export const GENERIC_SENT_MESSAGE = 'Si el correo está registrado, recibirás un enlace';

/** "Olvidé mi contraseña" (HU-018 CA1). */
export function ForgotPasswordForm() {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const submit = handleSubmit(async ({ email }) => {
    setOutcome(null);
    try {
      const result = await authApi.forgotPassword(email);
      setOutcome(
        result.status === 'sent'
          ? { kind: 'sent' }
          : { kind: 'rate_limited', minutes: result.retryAfterMinutes },
      );
    } catch {
      setOutcome({ kind: 'error' });
    }
  });

  if (outcome?.kind === 'sent') {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-3xl leading-tight font-bold">Revisa tu correo</h1>
        <Alert tone="info" role="status">
          {GENERIC_SENT_MESSAGE}. El enlace es válido por 30 minutos y solo se puede usar una vez.
        </Alert>
        <Link
          href={ROUTES.login}
          className="text-center text-[15px] font-bold text-brand underline underline-offset-2"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      aria-labelledby="olvide-titulo"
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        if (isSubmitting) {
          event.preventDefault();
          return;
        }
        void submit(event);
      }}
    >
      <div className="flex flex-col gap-2">
        <h1 id="olvide-titulo" className="font-display text-3xl leading-tight font-bold">
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="text-[15px] text-muted">
          Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva.
        </p>
      </div>

      <Field
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        error={errors.email?.message}
        {...register('email')}
      />

      {outcome?.kind === 'rate_limited' ? (
        <Alert tone="danger" role="alert">
          Hiciste demasiadas solicitudes. Inténtalo de nuevo en {outcome.minutes}{' '}
          {outcome.minutes === 1 ? 'minuto' : 'minutos'}.
        </Alert>
      ) : null}
      {outcome?.kind === 'error' ? (
        <Alert tone="danger" role="alert">
          No pudimos enviar la solicitud. Inténtalo de nuevo.
        </Alert>
      ) : null}

      <Button type="submit" aria-disabled={isSubmitting}>
        {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
      </Button>

      <Link
        href={ROUTES.login}
        className="text-center text-[15px] font-bold text-brand underline underline-offset-2"
      >
        Volver a iniciar sesión
      </Link>
    </form>
  );
}
