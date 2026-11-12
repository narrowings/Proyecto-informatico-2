'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { authApi } from '@/lib/api';
import { INVALID_CREDENTIALS_MESSAGE, loginSchema, type LoginFormValues } from '@/lib/auth/schemas';
import { ROUTES } from '@/lib/routes';

type Problem =
  | { kind: 'invalid' }
  | { kind: 'locked'; minutes: number }
  | { kind: 'unconfirmed' }
  | { kind: 'unexpected' };

type Resend = 'idle' | 'sending' | 'sent' | 'failed';

/** Inicio de sesión (HU-021). */
export function LoginForm({ sessionExpired = false }: { sessionExpired?: boolean }) {
  const router = useRouter();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [resend, setResend] = useState<Resend>('idle');

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setProblem(null);
    setResend('idle');
    try {
      const result = await authApi.login(values);
      switch (result.status) {
        case 'ok':
          router.replace(result.requiresTermsAcceptance ? ROUTES.acceptTerms : ROUTES.home);
          return;
        case 'invalid_credentials':
          setProblem({ kind: 'invalid' });
          return;
        case 'locked':
          setProblem({ kind: 'locked', minutes: result.retryAfterMinutes });
          return;
        case 'unconfirmed':
          setProblem({ kind: 'unconfirmed' });
          return;
      }
    } catch {
      setProblem({ kind: 'unexpected' });
    }
  });

  async function resendLink() {
    if (resend === 'sending') return;
    setResend('sending');
    try {
      await authApi.resendConfirmationLink(getValues('email').trim());
      setResend('sent');
    } catch {
      setResend('failed');
    }
  }

  return (
    <form
      noValidate
      aria-labelledby="login-titulo"
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
        <h1 id="login-titulo" className="font-display text-3xl leading-tight font-bold">
          Inicia sesión
        </h1>
        <p className="text-[15px] text-muted">Ingresa con tu correo y tu contraseña.</p>
      </div>

      {sessionExpired ? (
        <Alert tone="info" role="status">
          Tu sesión se cerró por inactividad. Inicia sesión de nuevo para continuar.
        </Alert>
      ) : null}

      <Field
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        error={errors.email?.message}
        {...register('email')}
      />
      <Field
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register('password')}
      />

      {problem?.kind === 'invalid' ? (
        <Alert tone="danger" role="alert">
          {INVALID_CREDENTIALS_MESSAGE}
        </Alert>
      ) : null}

      {problem?.kind === 'locked' ? (
        <Alert tone="danger" role="alert">
          Superaste el número de intentos permitidos. Por seguridad, bloqueamos el ingreso durante{' '}
          {problem.minutes} minutos. Inténtalo de nuevo más tarde.
        </Alert>
      ) : null}

      {problem?.kind === 'unexpected' ? (
        <Alert tone="danger" role="alert">
          No pudimos iniciar tu sesión. Inténtalo de nuevo.
        </Alert>
      ) : null}

      {problem?.kind === 'unconfirmed' ? (
        <div className="flex flex-col gap-3">
          <Alert tone="warning" role="alert">
            Debes confirmar tu correo electrónico para iniciar sesión. Revisa tu bandeja de entrada
            o solicita un nuevo enlace de confirmación.
          </Alert>
          {resend === 'sent' ? (
            <Alert tone="success" role="status">
              Te enviamos un nuevo enlace de confirmación. Revisa tu correo.
            </Alert>
          ) : null}
          {resend === 'failed' ? (
            <Alert tone="danger" role="alert">
              No pudimos enviar el enlace. Inténtalo de nuevo.
            </Alert>
          ) : null}
          <Button variant="secondary" aria-disabled={resend === 'sending'} onClick={resendLink}>
            {resend === 'sending' ? 'Enviando…' : 'Reenviar enlace de confirmación'}
          </Button>
        </div>
      ) : null}

      <Button type="submit" aria-disabled={isSubmitting}>
        {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
      </Button>

      <p className="text-center text-[15px] text-muted">
        ¿No tienes cuenta?{' '}
        <Link href={ROUTES.register} className="font-bold text-brand underline underline-offset-2">
          Crea una
        </Link>
      </p>
    </form>
  );
}
