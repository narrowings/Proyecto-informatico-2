'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { LegalLink } from '@/components/auth/legal-link';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { authApi } from '@/lib/api';
import { acceptTermsSchema, type AcceptTermsFormValues } from '@/lib/auth/schemas';
import { LEGAL_VERSIONS } from '@/lib/legal';
import { ROUTES } from '@/lib/routes';

/**
 * Aceptación de las nuevas versiones de los documentos legales antes de continuar
 * (HU-017 CA4). Se muestra tras iniciar sesión cuando hay versiones sin aceptar.
 */
export function AcceptTermsForm() {
  const router = useRouter();
  const [unexpectedError, setUnexpectedError] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AcceptTermsFormValues>({
    resolver: zodResolver(acceptTermsSchema),
    defaultValues: { termsAccepted: false, privacyAccepted: false, dataAuthorization: false },
  });

  const checks = useWatch({
    control,
    name: ['termsAccepted', 'privacyAccepted', 'dataAuthorization'],
  });
  const complete = checks.every(Boolean);

  const submit = handleSubmit(async () => {
    setUnexpectedError(false);
    try {
      await authApi.acceptTerms(LEGAL_VERSIONS);
      router.replace(ROUTES.home);
    } catch {
      setUnexpectedError(true);
    }
  });

  return (
    <form
      noValidate
      aria-labelledby="terminos-titulo"
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
        <h1 id="terminos-titulo" className="font-display text-3xl leading-tight font-bold">
          Actualizamos nuestros documentos
        </h1>
        <p className="text-[15px] text-muted">
          Para continuar debes aceptar las nuevas versiones de los documentos legales.
        </p>
      </div>

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
      </fieldset>

      {unexpectedError ? (
        <Alert tone="danger" role="alert">
          No pudimos registrar tu aceptación. Inténtalo de nuevo.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          aria-disabled={!complete || isSubmitting}
          aria-describedby={complete ? undefined : 'terminos-ayuda'}
        >
          {isSubmitting ? 'Guardando…' : 'Aceptar y continuar'}
        </Button>
        {complete ? null : (
          <p id="terminos-ayuda" className="text-[13px] text-muted">
            Marca las tres casillas para poder continuar.
          </p>
        )}
      </div>
    </form>
  );
}
