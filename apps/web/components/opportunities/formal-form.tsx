'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { opportunitiesApi } from '@/lib/api';
import { useCatalogs } from '@/lib/catalogs/use-catalogs';
import { waitMessage } from '@/lib/format';
import {
  emptyFormal,
  validateFormal,
  type FormalFormValues,
} from '@/lib/opportunities/formal-schema';
import { ROUTES } from '@/lib/routes';

/** HU-024: publicar una vacante de empleo formal. No lleva advertencia laboral. */
export function FormalForm({ onPublished }: { onPublished: (id: string) => void }) {
  const router = useRouter();
  const catalogs = useCatalogs();
  const [values, setValues] = useState<FormalFormValues>(emptyFormal);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [sending, setSending] = useState(false);
  const set = (key: keyof FormalFormValues) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  if (catalogs.status === 'loading') return <p role="status">Cargando…</p>;
  if (catalogs.status === 'error')
    return (
      <Alert tone="danger" role="alert">
        No pudimos cargar las zonas y categorías.{' '}
        <button type="button" className="font-bold underline" onClick={catalogs.reload}>
          Reintentar
        </button>
      </Alert>
    );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    const checked = validateFormal(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      setProblem('Revisa los campos marcados.');
      return;
    }
    setErrors({});
    setProblem(undefined);
    setSending(true);
    const result = await opportunitiesApi.publishFormal(checked.input).catch(() => null);
    setSending(false);
    if (!result) return setProblem('No pudimos publicar la vacante. Inténtalo de nuevo.');
    switch (result.status) {
      case 'published':
        return onPublished(result.id);
      case 'no_publisher_profile':
        return router.push(ROUTES.publisherProfile);
      case 'email_not_confirmed':
        return setProblem('Confirma tu correo antes de publicar.');
      case 'rate_limited':
        return setProblem(waitMessage(result.seconds));
      case 'invalid':
        setErrors(Object.fromEntries(Object.entries(result.errors).map(([k, v]) => [k, v[0]])));
        return setProblem('Revisa los campos marcados.');
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field
        label="Cargo"
        value={values.title}
        maxLength={120}
        onChange={set('title')}
        error={errors.title}
      />
      <Textarea
        label="Descripción de la vacante"
        value={values.description}
        maxLength={3000}
        onChange={set('description')}
        error={errors.description}
      />
      <Select
        label="Categoría"
        value={values.categoryId}
        onChange={set('categoryId')}
        error={errors.categoryId}
      >
        <option value="">Elige una categoría</option>
        {catalogs.categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <Select
        label="Zona de Cali"
        value={values.zoneId}
        onChange={set('zoneId')}
        error={errors.zoneId}
      >
        <option value="">Elige la zona</option>
        {catalogs.zones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.name}
          </option>
        ))}
      </Select>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Salario mínimo (pesos)"
          inputMode="numeric"
          value={values.salaryMin}
          onChange={set('salaryMin')}
          error={errors.salaryMin}
        />
        <Field
          label="Salario máximo (opcional)"
          inputMode="numeric"
          value={values.salaryMax}
          onChange={set('salaryMax')}
          error={errors.salaryMax}
          hint="Déjalo vacío si el salario es fijo."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Modalidad"
          value={values.modality}
          onChange={set('modality')}
          error={errors.modality}
        >
          <option value="">Elige la modalidad</option>
          <option value="ONSITE">Presencial</option>
          <option value="REMOTE">Remota</option>
          <option value="HYBRID">Híbrida</option>
        </Select>
        <Select
          label="Jornada"
          value={values.schedule}
          onChange={set('schedule')}
          error={errors.schedule}
        >
          <option value="">Elige la jornada</option>
          <option value="FULL_TIME">Tiempo completo</option>
          <option value="PART_TIME">Medio tiempo</option>
          <option value="SHIFTS">Por turnos</option>
          <option value="FLEXIBLE">Flexible</option>
        </Select>
      </div>
      <Textarea
        label="Experiencia requerida"
        value={values.experienceRequired}
        maxLength={500}
        onChange={set('experienceRequired')}
        error={errors.experienceRequired}
      />
      <Textarea
        label="Requisitos"
        value={values.requirements}
        maxLength={2000}
        onChange={set('requirements')}
        error={errors.requirements}
      />
      <Field
        label="Fecha de cierre (hora de Colombia)"
        type="datetime-local"
        value={values.closesAt}
        onChange={set('closesAt')}
        error={errors.closesAt}
      />
      <div aria-live="polite">{problem ? <Alert tone="danger">{problem}</Alert> : null}</div>
      <Button type="submit" aria-disabled={sending}>
        {sending ? 'Publicando…' : 'Publicar vacante'}
      </Button>
    </form>
  );
}
