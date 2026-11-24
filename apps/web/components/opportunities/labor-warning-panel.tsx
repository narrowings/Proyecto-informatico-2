'use client';

import type { Ref } from 'react';
import { Alert, Checkbox } from '@red/ui';
import type { LaborWarning, TaskType } from '@/lib/api';

/**
 * Advertencia de posible relación laboral (HU-003 CA2, Ley 2466 de 2025). El texto de
 * cada advertencia llega del API tal cual (lo aprueba asesoría jurídica): se muestra
 * como texto, sin modificarlo. Exige marcar "Leí la advertencia" antes de publicar.
 */
export function LaborWarningPanel({
  warnings,
  type,
  acknowledged,
  onAcknowledgedChange,
  error,
  checkboxRef,
}: {
  warnings: LaborWarning[];
  type: TaskType;
  acknowledged: boolean;
  onAcknowledgedChange(value: boolean): void;
  error?: string;
  checkboxRef?: Ref<HTMLInputElement>;
}) {
  // HU-025 CA3: con "Servicio" o "Proyecto" se recomienda revisar el tipo elegido.
  const reviewType = type === 'SERVICE' || type === 'PROJECT';

  return (
    <div className="flex flex-col gap-3">
      <Alert tone="warning" role="alert" className="flex flex-col gap-2">
        <p className="font-bold">Advertencia sobre posible relación laboral</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-4">
          {warnings.map((warning) => (
            <li key={warning.code}>{warning.message}</li>
          ))}
        </ul>
        {reviewType ? (
          <p>
            Si estas condiciones corresponden a un empleo, revisa el tipo elegido: quizá debas
            publicarla como empleo formal.
          </p>
        ) : null}
      </Alert>
      <Checkbox
        ref={checkboxRef}
        label="Leí la advertencia sobre relación laboral"
        checked={acknowledged}
        onChange={(event) => onAcknowledgedChange(event.target.checked)}
        error={error}
      />
    </div>
  );
}
