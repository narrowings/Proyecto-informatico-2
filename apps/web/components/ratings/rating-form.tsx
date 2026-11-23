'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ratingsApi } from '@/lib/api';
import { REPUTATION_DIMENSIONS } from '@/lib/api/reputation';
import {
  MAX_COMMENT_LENGTH,
  ratingSchema,
  type RatingFormValues,
} from '@/lib/ratings/rating-schema';
import { ROUTES } from '@/lib/routes';
import { StarRating } from './star-rating';

type Outcome =
  | { kind: 'rated'; published: boolean }
  | { kind: 'already_rated' }
  | { kind: 'not_completed' }
  | { kind: 'not_found' }
  | { kind: 'error' };

const HIDDEN_UNTIL_NOTE =
  'Tu calificación queda oculta hasta que la otra parte también califique o pasen 7 días, para evitar represalias.';

function Finished({ title, children }: { title: string; children: string }) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-3xl leading-tight font-bold">{title}</h1>
      <Alert tone="info" role="status">
        {children}
      </Alert>
      <ButtonLink href={ROUTES.activity} variant="secondary">
        Volver a Mi actividad
      </ButtonLink>
    </div>
  );
}

/**
 * Calificar a la contraparte de un trabajo completado (HU-007 CA1, CA2 y CA4).
 * En trabajos con varias personas, el publicador califica cada trabajo (uno por
 * trabajador) y cada trabajador califica una vez (CA3); el API lo garantiza.
 */
export function RatingForm({
  jobId,
  counterpartyName,
}: {
  jobId: string;
  counterpartyName?: string;
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<RatingFormValues>({
    resolver: zodResolver(ratingSchema),
    defaultValues: {
      fulfillment: null,
      punctuality: null,
      communication: null,
      quality: null,
      comment: '',
    },
    shouldFocusError: false,
  });

  useEffect(() => {
    if (submitCount === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [submitCount]);

  const comment = useWatch({ control, name: 'comment' }) ?? '';

  const submit = handleSubmit(async (values) => {
    setOutcome(null);
    try {
      const result = await ratingsApi.rateJob(jobId, {
        fulfillment: values.fulfillment!,
        punctuality: values.punctuality!,
        communication: values.communication!,
        quality: values.quality!,
        ...(values.comment ? { comment: values.comment } : {}),
      });
      if (result.status === 'invalid') {
        for (const [field, messages] of Object.entries(result.errors)) {
          if (field in values && messages[0])
            setError(field as keyof RatingFormValues, { message: messages[0] });
        }
        return;
      }
      setOutcome(
        result.status === 'rated'
          ? { kind: 'rated', published: result.published }
          : { kind: result.status },
      );
    } catch {
      setOutcome({ kind: 'error' });
    }
  });

  switch (outcome?.kind) {
    case 'rated':
      return (
        <Finished title="¡Gracias por calificar!">
          {outcome.published
            ? 'Ambas partes ya calificaron: las calificaciones ya son visibles en los perfiles.'
            : HIDDEN_UNTIL_NOTE}
        </Finished>
      );
    case 'already_rated':
      return (
        <Finished title="Ya calificaste este trabajo">
          Cada persona califica una sola vez y la calificación no se puede editar.
        </Finished>
      );
    case 'not_completed':
      return (
        <Finished title="Aún no puedes calificar">
          Solo se califica cuando el trabajo está completado: una parte lo marca como finalizado y
          la otra lo confirma.
        </Finished>
      );
    case 'not_found':
      return (
        <Finished title="No encontramos el trabajo">
          Revisa el enlace o entra desde Mi actividad.
        </Finished>
      );
  }

  return (
    <form
      ref={formRef}
      noValidate
      aria-labelledby="calificar-titulo"
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
        <h1 id="calificar-titulo" className="font-display text-3xl leading-tight font-bold">
          {counterpartyName ? `Califica a ${counterpartyName}` : 'Califica a la otra parte'}
        </h1>
        <p className="text-[15px] text-muted">De 1 a 5 estrellas en cada aspecto del trabajo.</p>
      </div>

      {REPUTATION_DIMENSIONS.map(({ key, label }) => (
        <Controller
          key={key}
          control={control}
          name={key}
          render={({ field }) => (
            <StarRating
              label={label}
              value={field.value}
              onChange={field.onChange}
              error={errors[key]?.message}
              firstInputRef={field.ref}
            />
          )}
        />
      ))}

      <Textarea
        label="Comentario (opcional)"
        maxLength={MAX_COMMENT_LENGTH}
        hint={`${comment.length} de ${MAX_COMMENT_LENGTH} caracteres. Se muestra sin tu nombre.`}
        error={errors.comment?.message}
        {...register('comment')}
      />

      <Alert tone="info">{HIDDEN_UNTIL_NOTE} No podrás editarla después de enviarla.</Alert>

      {outcome?.kind === 'error' ? (
        <Alert tone="danger" role="alert">
          No pudimos enviar tu calificación. Inténtalo de nuevo.
        </Alert>
      ) : null}

      <Button type="submit" aria-disabled={isSubmitting}>
        {isSubmitting ? 'Enviando…' : 'Enviar calificación'}
      </Button>
    </form>
  );
}
