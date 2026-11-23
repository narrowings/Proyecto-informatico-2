'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Alert, Button, Field, Select, Textarea } from '@red/ui';
import { opportunitiesApi, type LaborWarning, type TaskType } from '@/lib/api';
import { ApiError } from '@/lib/api/http';
import { useCatalogs } from '@/lib/catalogs/use-catalogs';
import { formatCop, waitMessage } from '@/lib/format';
import {
  DURATION_UNITS,
  MAX_CONDITIONS_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_PEOPLE_NEEDED,
  MAX_TITLE_LENGTH,
  parseCop,
  taskFormSchema,
  type TaskFormOutput,
  type TaskFormValues,
} from '@/lib/opportunities/task-schema';
import { ROUTES } from '@/lib/routes';
import { LaborWarningPanel } from './labor-warning-panel';

type Problem =
  | { kind: 'unexpected' }
  | { kind: 'email_not_confirmed' }
  | { kind: 'throttled'; seconds: number }
  | { kind: 'api'; message: string };

/** Campo del API -> campo del formulario, para mostrar cada error bajo su campo. */
const API_FIELDS: Record<string, keyof TaskFormValues> = {
  title: 'title',
  description: 'description',
  categoryId: 'categoryId',
  zoneId: 'zoneId',
  peopleNeeded: 'peopleNeeded',
  paymentCop: 'payment',
  scheduledAt: 'scheduledAt',
  durationMinutes: 'durationValue',
  conditions: 'conditions',
};

const defaultValues: TaskFormValues = {
  title: '',
  description: '',
  categoryId: '',
  zoneId: '',
  peopleNeeded: '1',
  payment: '',
  scheduledAt: '',
  durationValue: '',
  durationUnit: 'hours',
  conditions: '',
};

/**
 * Formulario para publicar una necesidad de tarea, trabajo rápido, proyecto o servicio
 * (HU-003). Nunca pide la dirección exacta: solo la zona (CA4).
 */
export function TaskForm({ type, onPublished }: { type: TaskType; onPublished(): void }) {
  const router = useRouter();
  const catalogs = useCatalogs();
  const [warnings, setWarnings] = useState<LaborWarning[] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledgeError, setAcknowledgeError] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const acknowledgeRef = useRef<HTMLInputElement>(null);

  const {
    register,
    control,
    watch,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues, unknown, TaskFormOutput>({
    resolver: zodResolver(taskFormSchema),
    defaultValues,
  });

  // Si cambia algo después de ver la advertencia, se vuelve a consultar al publicar.
  useEffect(() => {
    const subscription = watch(() => {
      setWarnings(null);
      setAcknowledged(false);
      setAcknowledgeError(false);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const payment = useWatch({ control, name: 'payment' });
  const amount = parseCop(payment ?? '');

  function showError(error: unknown) {
    if (error instanceof ApiError) {
      const code = error.problem.code;
      if (error.status === 401) return router.replace(ROUTES.login);
      if (error.status === 403 && code === 'PUBLISHER_PROFILE_REQUIRED')
        return router.replace(ROUTES.publisherProfile);
      if (error.status === 403 && code === 'EMAIL_NOT_CONFIRMED')
        return setProblem({ kind: 'email_not_confirmed' });
      if (error.status === 429) return setProblem({ kind: 'throttled', seconds: error.retryAfter });
      if (error.status === 400 && error.problem.errors) {
        const unmapped: string[] = [];
        let focused = false;
        for (const [apiField, messages] of Object.entries(error.problem.errors)) {
          const field = API_FIELDS[apiField];
          if (field) {
            setError(field, { message: messages[0] }, { shouldFocus: !focused });
            focused = true;
          } else {
            unmapped.push(...messages);
          }
        }
        if (unmapped.length > 0) setProblem({ kind: 'api', message: unmapped.join(' ') });
        return;
      }
    }
    setProblem({ kind: 'unexpected' });
  }

  const submit = handleSubmit(async (values) => {
    setProblem(null);
    const input = { type, ...values };
    try {
      let pending = warnings;
      if (pending === null) {
        // HU-003 CA2: antes de publicar se consulta si las condiciones requieren advertencia.
        pending = await opportunitiesApi.previewLaborWarnings(input);
        if (pending.length > 0) {
          setWarnings(pending);
          return;
        }
      } else if (pending.length > 0 && !acknowledged) {
        setAcknowledgeError(true);
        acknowledgeRef.current?.focus();
        return;
      }
      const result = await opportunitiesApi.publish(input, pending.length > 0);
      if (result.ok) {
        onPublished();
        return;
      }
      // Las reglas cambiaron entre la consulta y el envío: se muestran y se pide confirmar.
      setWarnings(result.warnings);
      setAcknowledged(false);
    } catch (error) {
      showError(error);
    }
  });

  if (catalogs.status === 'loading') return <p role="status">Cargando…</p>;
  if (catalogs.status === 'error') {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="danger" role="alert">
          No pudimos cargar las categorías y zonas. Inténtalo de nuevo.
        </Alert>
        <Button variant="secondary" onClick={catalogs.reload}>
          Reintentar
        </Button>
      </div>
    );
  }

  const shownWarnings = warnings && warnings.length > 0 ? warnings : null;
  const warned = shownWarnings !== null;

  return (
    <form
      noValidate
      aria-label="Datos de la oportunidad"
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        if (isSubmitting) {
          event.preventDefault();
          return;
        }
        void submit(event);
      }}
    >
      <fieldset disabled={isSubmitting} className="flex min-w-0 flex-col gap-5">
        <legend className="sr-only">Datos de la oportunidad</legend>
        <Field
          label="Actividad"
          maxLength={MAX_TITLE_LENGTH}
          required
          error={errors.title?.message}
          {...register('title')}
        />
        <Select
          label="Categoría"
          required
          error={errors.categoryId?.message}
          {...register('categoryId')}
        >
          <option value="">Elige una categoría</option>
          {catalogs.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Textarea
          label="Descripción"
          maxLength={MAX_DESCRIPTION_LENGTH}
          required
          error={errors.description?.message}
          {...register('description')}
        />
        <Field
          label="Cantidad de personas"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_PEOPLE_NEEDED}
          required
          error={errors.peopleNeeded?.message}
          {...register('peopleNeeded')}
        />
        <Field
          label="Pago ofrecido (COP)"
          inputMode="numeric"
          required
          hint={
            amount !== null && amount > 0
              ? `Pago: ${formatCop(amount)}`
              : 'En pesos colombianos, sin decimales. Por ejemplo: 70000.'
          }
          error={errors.payment?.message}
          {...register('payment')}
        />
        <Field
          label="Fecha y hora"
          type="datetime-local"
          required
          hint="En hora de Colombia."
          error={errors.scheduledAt?.message}
          {...register('scheduledAt')}
        />
        <div className="grid grid-cols-[1fr_8rem] items-start gap-3">
          <Field
            label="Duración"
            inputMode="decimal"
            required
            error={errors.durationValue?.message}
            {...register('durationValue')}
          />
          <Select label="Unidad" {...register('durationUnit')}>
            {Object.entries(DURATION_UNITS).map(([unit, { label }]) => (
              <option key={unit} value={unit}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Select
          label="Zona de Cali"
          required
          hint="Solo se muestra la zona. La dirección exacta se pide después, cuando ambas partes lleguen a un acuerdo."
          error={errors.zoneId?.message}
          {...register('zoneId')}
        >
          <option value="">Elige la zona</option>
          {catalogs.zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </Select>
        <Textarea
          label="Condiciones (opcional)"
          maxLength={MAX_CONDITIONS_LENGTH}
          error={errors.conditions?.message}
          {...register('conditions')}
        />
      </fieldset>

      {shownWarnings ? (
        <LaborWarningPanel
          warnings={shownWarnings}
          type={type}
          acknowledged={acknowledged}
          onAcknowledgedChange={(value) => {
            setAcknowledged(value);
            if (value) setAcknowledgeError(false);
          }}
          error={
            acknowledgeError ? 'Confirma que leíste la advertencia para poder publicar.' : undefined
          }
          checkboxRef={acknowledgeRef}
        />
      ) : null}

      {problem?.kind === 'email_not_confirmed' ? (
        <Alert tone="warning" role="alert">
          Debes confirmar tu correo electrónico para publicar. Revisa tu bandeja de entrada.
        </Alert>
      ) : null}
      {problem?.kind === 'throttled' ? (
        <Alert tone="danger" role="alert">
          Publicaste demasiadas oportunidades en poco tiempo. {waitMessage(problem.seconds)}
        </Alert>
      ) : null}
      {problem?.kind === 'api' ? (
        <Alert tone="danger" role="alert">
          {problem.message}
        </Alert>
      ) : null}
      {problem?.kind === 'unexpected' ? (
        <Alert tone="danger" role="alert">
          No pudimos publicar tu oportunidad. Inténtalo de nuevo.
        </Alert>
      ) : null}

      <Button type="submit" aria-disabled={isSubmitting}>
        {isSubmitting ? 'Publicando…' : warned ? 'Confirmar y publicar' : 'Publicar'}
      </Button>
    </form>
  );
}
