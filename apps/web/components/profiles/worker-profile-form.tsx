'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { catalogsApi, profilesApi, type Category, type Zone } from '@/lib/api';
import {
  MAX_EXPERIENCE_LENGTH,
  MAX_NAME_LENGTH,
  workerProfileSchema,
  type WorkerProfileFormOutput,
  type WorkerProfileFormValues,
} from '@/lib/profiles/worker-schema';
import { ROUTES } from '@/lib/routes';
import { useCurrentUser } from '@/lib/session/use-current-user';
import { CategoryPicker } from './category-picker';
import { PhotoInput } from './photo-input';
import { SkillsInput } from './skills-input';

type Catalogs =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; zones: Zone[]; categories: Category[] };

type Outcome = 'created' | 'already_exists' | 'error' | null;

function useCatalogs(): Catalogs {
  const [catalogs, setCatalogs] = useState<Catalogs>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    Promise.all([catalogsApi.listZones(), catalogsApi.listCategories()])
      .then(([zones, categories]) => {
        if (active) setCatalogs({ status: 'ready', zones, categories });
      })
      .catch(() => {
        if (active) setCatalogs({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, []);
  return catalogs;
}

function ProfileReady() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl leading-tight font-bold">¡Tu perfil está listo!</h1>
        <p role="status" className="flex items-center gap-2 text-[15px] font-bold text-brand-dark">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-brand" />
          Estado: Disponible
        </p>
        <p className="text-[15px] text-muted">
          Los publicadores ya pueden ver tus habilidades y te mostraremos oportunidades compatibles.
        </p>
      </div>
      <ButtonLink href={ROUTES.work}>Ver oportunidades</ButtonLink>
    </div>
  );
}

/** Creación del perfil de trabajador (HU-002 CA1 y CA2). */
export function WorkerProfileForm({ fromWork = false }: { fromWork?: boolean }) {
  const router = useRouter();
  const session = useCurrentUser();
  const catalogs = useCatalogs();
  const [outcome, setOutcome] = useState<Outcome>(null);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<WorkerProfileFormValues, unknown, WorkerProfileFormOutput>({
    resolver: zodResolver(workerProfileSchema),
    // El foco se mueve a mano al primer error en el orden de la pantalla (ver efecto abajo).
    shouldFocusError: false,
    defaultValues: {
      photo: null,
      displayName: '',
      skills: [],
      experience: '',
      categoryIds: [],
      zoneId: '',
    },
  });

  const user = session.status === 'ready' ? session.user : null;
  const noSession = session.status === 'ready' && user === null;

  useEffect(() => {
    if (noSession) router.replace(ROUTES.login);
  }, [noSession, router]);

  // El nombre viene de la cuenta (HU-001); se puede ajustar para el perfil.
  useEffect(() => {
    if (user && !getValues('displayName')) setValue('displayName', user.name);
  }, [user, getValues, setValue]);

  // Tras un envío con errores, lleva el foco al primer campo marcado (de arriba abajo).
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (submitCount === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [submitCount]);

  const displayName = useWatch({ control, name: 'displayName' });
  const experience = useWatch({ control, name: 'experience' }) ?? '';

  const submit = handleSubmit(async (values) => {
    setOutcome(null);
    try {
      const { url } = await profilesApi.uploadProfilePhoto(values.photo);
      const result = await profilesApi.createWorkerProfile({
        displayName: values.displayName,
        photoUrl: url,
        skills: values.skills,
        experience: values.experience || undefined,
        zoneId: Number(values.zoneId),
        categoryIds: values.categoryIds,
      });
      setOutcome(result.ok ? 'created' : result.reason);
    } catch {
      setOutcome('error');
    }
  });

  if (outcome === 'created') return <ProfileReady />;

  if (session.status === 'loading' || catalogs.status === 'loading' || noSession) {
    return (
      <p role="status" className="text-[15px] text-muted">
        Cargando…
      </p>
    );
  }

  if (session.status === 'error' || catalogs.status === 'error') {
    return (
      <Alert tone="danger" role="alert">
        No pudimos cargar el formulario. Recarga la página para intentarlo de nuevo.
      </Alert>
    );
  }

  if (user?.hasWorkerProfile || outcome === 'already_exists') {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-3xl leading-tight font-bold">
          Ya tienes perfil de trabajador
        </h1>
        <ButtonLink href={ROUTES.work}>Ver oportunidades</ButtonLink>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      aria-labelledby="perfil-trabajador-titulo"
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
        <h1 id="perfil-trabajador-titulo" className="font-display text-3xl leading-tight font-bold">
          Crea tu perfil de trabajador
        </h1>
        <p className="text-[15px] text-muted">
          Con tus habilidades y tu zona te recomendamos oportunidades y generas confianza en quienes
          publican.
        </p>
      </div>

      {fromWork ? (
        <Alert tone="info">Para ver oportunidades, primero completa tu perfil de trabajador.</Alert>
      ) : null}

      <Controller
        control={control}
        name="photo"
        render={({ field }) => (
          <PhotoInput
            value={field.value}
            onChange={field.onChange}
            name={displayName}
            error={errors.photo?.message}
            inputRef={field.ref}
          />
        )}
      />

      <Field
        label="Nombre"
        autoComplete="name"
        maxLength={MAX_NAME_LENGTH}
        required
        error={errors.displayName?.message}
        {...register('displayName')}
      />

      <Controller
        control={control}
        name="skills"
        render={({ field }) => (
          <SkillsInput
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.skills?.message}
            inputRef={field.ref}
          />
        )}
      />

      <Textarea
        label="Experiencia (opcional)"
        maxLength={MAX_EXPERIENCE_LENGTH}
        placeholder="Cuéntanos en qué has trabajado, aunque no haya sido un empleo formal."
        hint={`${experience.length} de ${MAX_EXPERIENCE_LENGTH} caracteres`}
        error={errors.experience?.message}
        {...register('experience')}
      />

      <Controller
        control={control}
        name="categoryIds"
        render={({ field }) => (
          <CategoryPicker
            categories={catalogs.categories}
            value={field.value}
            onChange={field.onChange}
            error={errors.categoryIds?.message}
            firstInputRef={field.ref}
          />
        )}
      />

      <Select
        label="Zona de Cali"
        hint="Solo se muestra la zona aproximada, nunca tu dirección."
        required
        error={errors.zoneId?.message}
        {...register('zoneId')}
      >
        <option value="">Elige tu zona</option>
        {catalogs.zones.map((zone) => (
          <option key={zone.id} value={String(zone.id)}>
            {zone.name}
          </option>
        ))}
      </Select>

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
