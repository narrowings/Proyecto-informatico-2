'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useForm, useWatch, type FieldError } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { authApi } from '@/lib/api';
import {
  EMAIL_TAKEN_MESSAGE,
  PASSWORD_HINT,
  registerSchema,
  type RegisterFormValues,
} from '@/lib/auth/schemas';
import { LEGAL_VERSIONS } from '@/lib/legal';
import { ROUTES } from '@/lib/routes';

function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-bold text-brand underline underline-offset-2"
    >
      {children}
      <span className="sr-only"> (se abre en una pestaña nueva)</span>
    </Link>
  );
}

function emailError(error?: FieldError): ReactNode {
  if (!error) return undefined;
  if (error.type === 'email_taken') {
    return (
      <>
        Este correo ya está registrado. Por favor,{' '}
        <Link href={ROUTES.login} className="font-bold underline underline-offset-2">
          inicia sesión
        </Link>
        .
      </>
    );
  }
  return error.message;
}

/** Registro de usuario (HU-001) con casillas legales y confirmación de mayoría de edad (HU-017). */
export function RegisterForm() {
  const router = useRouter();
  const [unexpectedError, setUnexpectedError] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      termsAccepted: false,
      privacyAccepted: false,
      dataAuthorization: false,
      isAdult: false,
    },
  });

  const legalChecks = useWatch({
    control,
    name: ['termsAccepted', 'privacyAccepted', 'dataAuthorization', 'isAdult'],
  });
  const legalComplete = legalChecks.every(Boolean);

  const submit = handleSubmit(async (values) => {
    setUnexpectedError(false);
    try {
      const result = await authApi.register({
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        consents: { ...LEGAL_VERSIONS, isAdult: true },
      });
      if (result.ok) {
        router.push(ROUTES.registerPending);
        return;
      }
      setError(
        'email',
        { type: 'email_taken', message: EMAIL_TAKEN_MESSAGE },
        { shouldFocus: true },
      );
    } catch {
      setUnexpectedError(true);
    }
  });

  return (
    <form
      noValidate
      aria-labelledby="registro-titulo"
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
        <h1 id="registro-titulo" className="font-display text-3xl leading-tight font-bold">
          Crea tu cuenta
        </h1>
        <p className="text-[15px] text-muted">
          Para acceder a la red de oportunidades laborales de Cali.
        </p>
      </div>

      <Field
        label="Nombre"
        autoComplete="name"
        required
        error={errors.name?.message}
        {...register('name')}
      />
      <Field
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        error={emailError(errors.email)}
        {...register('email')}
      />
      <Field
        label="Número de contacto"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        required
        hint="Solo se usa de forma interna; no se muestra públicamente."
        error={errors.phone?.message}
        {...register('phone')}
      />
      <Field
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        required
        hint={PASSWORD_HINT}
        error={errors.password?.message}
        {...register('password')}
      />

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-[13px] font-bold">Requisitos legales</legend>
        <Checkbox
          label={
            <>
              Acepto los <LegalLink href={ROUTES.terms}>términos y condiciones</LegalLink>
            </>
          }
          error={errors.termsAccepted?.message}
          {...register('termsAccepted')}
        />
        <Checkbox
          label={
            <>
              Acepto la <LegalLink href={ROUTES.privacy}>política de privacidad</LegalLink>
            </>
          }
          error={errors.privacyAccepted?.message}
          {...register('privacyAccepted')}
        />
        <Checkbox
          label={
            <>
              Autorizo el{' '}
              <LegalLink href={ROUTES.dataProcessing}>
                tratamiento de mis datos personales
              </LegalLink>
            </>
          }
          error={errors.dataAuthorization?.message}
          {...register('dataAuthorization')}
        />
        <Checkbox
          label="Confirmo que soy mayor de 18 años"
          error={errors.isAdult?.message}
          {...register('isAdult')}
        />
      </fieldset>

      {unexpectedError ? (
        <Alert tone="danger" role="alert">
          No pudimos crear tu cuenta. Inténtalo de nuevo.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          aria-disabled={!legalComplete || isSubmitting}
          aria-describedby={legalComplete ? undefined : 'registro-ayuda-legal'}
        >
          {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
        {legalComplete ? null : (
          <p id="registro-ayuda-legal" className="text-[13px] text-muted">
            Marca las cuatro casillas para poder crear tu cuenta.
          </p>
        )}
      </div>
    </form>
  );
}
