'use client';

import { useState } from 'react';
import { Button, ButtonLink } from '@red/ui';
import type { OpportunityType, TaskType } from '@/lib/api';
import { OPPORTUNITY_TYPES } from '@/lib/opportunities/types';
import { ROUTES } from '@/lib/routes';
import { FormalForm } from './formal-form';
import { TaskForm } from './task-form';
import { TypeSelector } from './type-selector';

type Step = 'type' | 'form' | 'done';

/**
 * "Necesito ayuda": elegir el tipo de oportunidad (HU-025) y publicar la necesidad (HU-003).
 * Con `FORMAL_JOB` se muestra el formulario de vacante formal (HU-024).
 */
export function PublishFlow() {
  const [step, setStep] = useState<Step>('type');
  const [type, setType] = useState<OpportunityType | null>(null);
  const formal = type === 'FORMAL_JOB';
  const label = OPPORTUNITY_TYPES.find((option) => option.value === type)?.label;

  if (step === 'done') {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-3xl leading-tight font-bold">
          ¡Tu oportunidad ya está publicada!
        </h1>
        <p role="status" className="text-[15px] text-muted">
          Las personas compatibles de Cali ya pueden verla y mostrar su interés.
        </p>
        <ButtonLink href={ROUTES.activity}>Ver mi actividad</ButtonLink>
        <Button
          variant="secondary"
          onClick={() => {
            setType(null);
            setStep('type');
          }}
        >
          Publicar otra
        </Button>
      </div>
    );
  }

  if (step === 'form' && formal) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl leading-tight font-bold">Publica tu vacante</h1>
          <p className="flex flex-wrap items-center gap-x-3 text-[15px] text-muted">
            <span>
              Tipo: <strong className="text-ink">{label}</strong>
            </span>
            <button
              type="button"
              onClick={() => setStep('type')}
              className="min-h-11 font-bold text-brand underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Cambiar tipo
            </button>
          </p>
        </div>
        <FormalForm onPublished={() => setStep('done')} />
      </div>
    );
  }

  if (step === 'form' && type && !formal) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl leading-tight font-bold">Cuéntanos qué necesitas</h1>
          <p className="flex flex-wrap items-center gap-x-3 text-[15px] text-muted">
            <span>
              Tipo: <strong className="text-ink">{label}</strong>
            </span>
            <button
              type="button"
              onClick={() => setStep('type')}
              className="min-h-11 font-bold text-brand underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Cambiar tipo
            </button>
          </p>
        </div>
        <TaskForm type={type as TaskType} onPublished={() => setStep('done')} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight font-bold">Publicar una necesidad</h1>
        <p className="text-[15px] text-muted">
          Elige qué tipo de oportunidad quieres publicar; según el tipo te mostramos el formulario
          adecuado.
        </p>
      </div>
      <TypeSelector value={type} onChange={setType} />
      <div className="flex flex-col gap-2">
        <Button
          aria-disabled={!type}
          aria-describedby={!type ? 'publicar-ayuda' : undefined}
          onClick={() => setStep('form')}
        >
          Continuar
        </Button>
        {!type ? (
          <p id="publicar-ayuda" className="text-[13px] text-muted">
            Elige un tipo para continuar.
          </p>
        ) : null}
      </div>
    </div>
  );
}
