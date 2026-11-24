'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  profilesApi,
  type Category,
  type OwnWorkerProfile,
  type UpdateWorkerProfileRequest,
  type Zone,
} from '@/lib/api';
import {
  MAX_EXPERIENCE_LENGTH,
  MAX_NAME_LENGTH,
  workerProfileEditSchema,
  type WorkerProfileEditValues,
} from '@/lib/profiles/worker-schema';
import { CategoryPicker } from './category-picker';
import { SkillsInput } from './skills-input';

type Outcome = 'saved' | 'unchanged' | 'error' | null;

const toValues = (profile: OwnWorkerProfile): WorkerProfileEditValues => ({
  displayName: profile.displayName,
  skills: profile.skills,
  experience: profile.experience ?? '',
  categoryIds: profile.categoryIds,
  zoneId: String(profile.zoneId),
});

const sortedKey = (ids: number[]) => [...ids].sort((x, y) => x - y).join(',');
const sameIds = (a: number[], b: number[]) => sortedKey(a) === sortedKey(b);

/** Solo lo que cambió respecto al perfil guardado (el API deja igual lo demás). */
export function changedFields(
  saved: OwnWorkerProfile,
  values: WorkerProfileEditValues,
): UpdateWorkerProfileRequest {
  const changes: UpdateWorkerProfileRequest = {};
  if (values.displayName !== saved.displayName) changes.displayName = values.displayName;
  if (values.skills.join('\n') !== saved.skills.join('\n')) changes.skills = values.skills;
  if (values.experience !== (saved.experience ?? '')) changes.experience = values.experience;
  if (!sameIds(values.categoryIds, saved.categoryIds)) changes.categoryIds = values.categoryIds;
  if (Number(values.zoneId) !== saved.zoneId) changes.zoneId = Number(values.zoneId);
  return changes;
}

/** Edición de los datos del perfil de trabajador (HU-032 CA1). */
export function WorkerProfileEditForm({
  profile,
  zones,
  categories,
  onSaved,
}: {
  profile: OwnWorkerProfile;
  zones: Zone[];
  categories: Category[];
  onSaved(profile: OwnWorkerProfile): void;
}) {
  const [outcome, setOutcome] = useState<Outcome>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<WorkerProfileEditValues>({
    resolver: zodResolver(workerProfileEditSchema),
    defaultValues: toValues(profile),
    shouldFocusError: false,
  });

  // Tras un envío con errores, el foco va al primer campo marcado. Solo depende del envío
  // para no quitarle el foco a quien está escribiendo mientras se revalida.
  useEffect(() => {
    if (submitCount === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [submitCount]);

  const experience = useWatch({ control, name: 'experience' }) ?? '';

  const submit = handleSubmit(async (values) => {
    setOutcome(null);
    const changes = changedFields(profile, values);
    if (Object.keys(changes).length === 0) {
      setOutcome('unchanged');
      return;
    }
    try {
      const result = await profilesApi.updateWorkerProfile(changes);
      if (result.ok) {
        reset(toValues(result.profile));
        onSaved(result.profile);
        setOutcome('saved');
        return;
      }
      for (const [field, messages] of Object.entries(result.errors)) {
        if (field in values && messages[0])
          setError(field as keyof WorkerProfileEditValues, { message: messages[0] });
      }
    } catch {
      setOutcome('error');
    }
  });

  return (
    <form
      ref={formRef}
      noValidate
      aria-labelledby="editar-perfil-titulo"
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        if (isSubmitting) {
          event.preventDefault();
          return;
        }
        void submit(event);
      }}
    >
      <h2 id="editar-perfil-titulo" className="font-display text-2xl font-bold">
        Datos del perfil
      </h2>

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
        hint={`${experience.length} de ${MAX_EXPERIENCE_LENGTH} caracteres. Déjala vacía para borrarla.`}
        error={errors.experience?.message}
        {...register('experience')}
      />

      <Controller
        control={control}
        name="categoryIds"
        render={({ field }) => (
          <CategoryPicker
            categories={categories}
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
        {zones.map((zone) => (
          <option key={zone.id} value={String(zone.id)}>
            {zone.name}
          </option>
        ))}
      </Select>

      {outcome === 'saved' ? (
        <Alert tone="success" role="status">
          Guardamos los cambios. Tus recomendaciones se ajustarán a los nuevos datos.
        </Alert>
      ) : null}
      {outcome === 'unchanged' ? (
        <Alert tone="info" role="status">
          No hay cambios por guardar.
        </Alert>
      ) : null}
      {outcome === 'error' ? (
        <Alert tone="danger" role="alert">
          No pudimos guardar los cambios. Inténtalo de nuevo.
        </Alert>
      ) : null}

      <Button type="submit" aria-disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </form>
  );
}
