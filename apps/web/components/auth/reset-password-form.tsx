'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { authApi } from '@/lib/api';
import {
  MAX_PASSWORD_LENGTH,
  PASSWORD_HINT,
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '@/lib/auth/schemas';
import { PASSWORD_RESET_REASON } from '@/lib/auth/session';
import { ROUTES } from '@/lib/routes';

type Problem = { kind: 'rate_limited'; minutes: number } | { kind: 'error' };

function ExpiredLink() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight font-bold">El enlace ya no es válido</h1>
        <p className="text-[15px] text-muted">
          Venció (dura 30 minutos) o ya se usó. Pide uno nuevo para cambiar tu contraseña.
        </p>
      </div>
      <ButtonLink href={ROUTES.forgotPassword}>Pedir un enlace nuevo</ButtonLink>
    </div>
  );
}

/** Nueva contraseña desde el enlace del correo (HU-018 CA2–CA4). */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [expired, setExpired] = useState(!token);
  const [problem, setProblem] = useState<Problem | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', passwordConfirmation: '' },
  });

  const submit = handleSubmit(async (values) => {
    setProblem(null);
    try {
      const result = await authApi.resetPassword({ token, ...values });
      switch (result.status) {
        case 'ok':
          // El API cierra todas las sesiones: se vuelve a iniciar sesión con la nueva contraseña.
          router.replace(`${ROUTES.login}?motivo=${PASSWORD_RESET_REASON}`);
          return;
        case 'expired':
          setExpired(true);
          return;
        case 'invalid':
          for (const field of ['password', 'passwordConfirmation'] as const) {
            const message = result.errors[field]?.[0];
            if (message) setError(field, { message });
          }
          if (result.errors.token) setExpired(true);
          return;
        case 'rate_limited':
          setProblem({ kind: 'rate_limited', minutes: result.retryAfterMinutes });
          return;
      }
    } catch {
      setProblem({ kind: 'error' });
    }
  });

  if (expired) return <ExpiredLink />;

  return (
    <form
      noValidate
      aria-labelledby="restablecer-titulo"
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
        <h1 id="restablecer-titulo" className="font-display text-3xl leading-tight font-bold">
          Crea una contraseña nueva
        </h1>
        <p className="text-[15px] text-muted">
          Al cambiarla cerraremos tus sesiones abiertas y tendrás que iniciar sesión de nuevo.
        </p>
      </div>

      <Field
        label="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        maxLength={MAX_PASSWORD_LENGTH}
        required
        hint={PASSWORD_HINT}
        error={errors.password?.message}
        {...register('password')}
      />
      <Field
        label="Confirma la contraseña nueva"
        type="password"
        autoComplete="new-password"
        maxLength={MAX_PASSWORD_LENGTH}
        required
        error={errors.passwordConfirmation?.message}
        {...register('passwordConfirmation')}
      />

      {problem?.kind === 'rate_limited' ? (
        <Alert tone="danger" role="alert">
          Hiciste demasiados intentos. Inténtalo de nuevo en {problem.minutes}{' '}
          {problem.minutes === 1 ? 'minuto' : 'minutos'}.
        </Alert>
      ) : null}
      {problem?.kind === 'error' ? (
        <Alert tone="danger" role="alert">
          No pudimos cambiar tu contraseña. Inténtalo de nuevo.
        </Alert>
      ) : null}

      <Button type="submit" aria-disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Cambiar contraseña'}
      </Button>
    </form>
  );
}
