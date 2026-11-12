'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, Button, ButtonLink, Field, Select, Textarea } from '@red/ui';
import { profilesApi } from '@/lib/api';
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_PUBLISHER_NAME_LENGTH,
  publisherProfileSchema,
  type PublisherProfileFormValues,
  type PublisherProfileFormOutput,
} from '@/lib/profiles/publisher-schema';
import { ROUTES } from '@/lib/routes';
import { useCurrentUser } from '@/lib/session/use-current-user';
import { PhotoInput } from './photo-input';

const defaultValues = {
  kind: 'PERSON' as const,
  displayName: '',
  description: '',
  photo: null,
  nit: '',
  nitCheckDigit: '',
  contactName: '',
  sector: '',
};

/** HU-008 CA1 y CA2. Una cuenta conserva su perfil de trabajador al crear este. */
export function PublisherProfileForm() {
  const router = useRouter();
  const session = useCurrentUser();
  const [outcome, setOutcome] = useState<'created' | 'already_exists' | 'error' | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const {
    register,
    control,
    getValues,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<PublisherProfileFormValues, unknown, PublisherProfileFormOutput>({
    resolver: zodResolver(publisherProfileSchema),
    shouldFocusError: false,
    defaultValues,
  });
  const kind = useWatch({ control, name: 'kind' });
  const displayName = useWatch({ control, name: 'displayName' });
  const company = kind === 'COMPANY';
  const user = session.status === 'ready' ? session.user : null;
  const noSession = session.status === 'ready' && !user;
  const publicProfileId = profileId ?? user?.publisherProfileId;

  useEffect(() => {
    if (noSession) router.replace(ROUTES.login);
  }, [noSession, router]);
  useEffect(() => {
    if (user && !getValues('displayName')) setValue('displayName', user.name);
  }, [user, getValues, setValue]);
  useEffect(() => {
    if (submitCount) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [submitCount]);

  const submit = handleSubmit(async (values) => {
    setOutcome(null);
    try {
      const { photo, ...details } = values;
      const { url } = await profilesApi.uploadProfilePhoto(photo);
      const result = await profilesApi.createPublisherProfile({ ...details, photoUrl: url });
      if (result.ok) setProfileId(result.profile.id);
      setOutcome(result.ok ? 'created' : result.reason);
    } catch {
      setOutcome('error');
    }
  });

  if (session.status === 'loading' || noSession) return <p role="status">Cargando…</p>;
  if (session.status === 'error')
    return (
      <Alert tone="danger" role="alert">
        No pudimos cargar el formulario. Recarga la página para intentarlo de nuevo.
      </Alert>
    );
  if (outcome === 'created' || user?.hasPublisherProfile || outcome === 'already_exists') {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-3xl leading-tight font-bold">
          {outcome === 'created'
            ? '¡Tu perfil de publicador está listo!'
            : 'Ya tienes perfil de publicador'}
        </h1>
        <p role="status" className="text-[15px] text-muted">
          Ya puedes continuar para publicar una oportunidad.
        </p>
        <ButtonLink href={ROUTES.publish}>Continuar para publicar</ButtonLink>
        {publicProfileId ? (
          <ButtonLink
            href={`/publicadores/${encodeURIComponent(publicProfileId)}`}
            variant="secondary"
          >
            Ver perfil público
          </ButtonLink>
        ) : null}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      aria-labelledby="perfil-publicador-titulo"
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
        <h1 id="perfil-publicador-titulo" className="font-display text-3xl leading-tight font-bold">
          Crea tu perfil de publicador
        </h1>
        <p className="text-[15px] text-muted">
          Presenta tu actividad para generar confianza en quienes ven tus oportunidades.
        </p>
      </div>
      <fieldset disabled={isSubmitting} className="flex min-w-0 flex-col gap-5">
        <legend className="sr-only">Datos del publicador</legend>
        <Select label="Tipo de perfil" {...register('kind')}>
          <option value="PERSON">Persona natural</option>
          <option value="COMPANY">Empresa</option>
        </Select>
        <Controller
          control={control}
          name="photo"
          render={({ field }) => (
            <PhotoInput
              value={field.value}
              onChange={field.onChange}
              name={displayName}
              label={company ? 'logo' : 'foto'}
              error={errors.photo?.message}
              inputRef={field.ref}
            />
          )}
        />
        <Field
          label={company ? 'Razón social' : 'Nombre'}
          autoComplete={company ? 'organization' : 'name'}
          maxLength={MAX_PUBLISHER_NAME_LENGTH}
          required
          error={errors.displayName?.message}
          {...register('displayName')}
        />
        {company ? (
          <>
            <Field
              label="NIT"
              hint="Sin puntos ni dígito de verificación."
              inputMode="numeric"
              maxLength={10}
              required
              error={'nit' in errors ? errors.nit?.message : undefined}
              {...register('nit')}
            />
            <Field
              label="Dígito de verificación"
              inputMode="numeric"
              maxLength={1}
              required
              error={'nitCheckDigit' in errors ? errors.nitCheckDigit?.message : undefined}
              {...register('nitCheckDigit')}
            />
            <Field
              label="Contacto o representante"
              autoComplete="name"
              maxLength={120}
              required
              error={'contactName' in errors ? errors.contactName?.message : undefined}
              {...register('contactName')}
            />
            <Field
              label="Sector"
              maxLength={100}
              required
              error={'sector' in errors ? errors.sector?.message : undefined}
              {...register('sector')}
            />
          </>
        ) : null}
        <Textarea
          label="Descripción"
          maxLength={MAX_DESCRIPTION_LENGTH}
          hint={`Máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`}
          required
          error={errors.description?.message}
          {...register('description')}
        />
      </fieldset>
      {outcome === 'error' ? (
        <Alert tone="danger" role="alert">
          No pudimos guardar tu perfil. Inténtalo de nuevo.
        </Alert>
      ) : null}
      <Button type="submit" aria-disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Guardar perfil'}
      </Button>
    </form>
  );
}
