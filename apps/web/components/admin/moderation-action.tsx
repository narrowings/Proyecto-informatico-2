'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api';
import { adminResultMessage, type ModerationAction } from '@/lib/api/admin';
import { ReasonDialog } from './reason-dialog';

const COPY: Record<ModerationAction['kind'], { label: string; title: string; confirm: string }> = {
  hide: { label: 'Ocultar publicación', title: 'Ocultar publicación', confirm: 'Ocultar' },
  unhide: { label: 'Mostrar de nuevo', title: 'Mostrar publicación', confirm: 'Mostrar' },
  suspend: { label: 'Suspender', title: 'Suspender cuenta', confirm: 'Suspender' },
  block: { label: 'Bloquear', title: 'Bloquear cuenta', confirm: 'Bloquear' },
  reactivate: { label: 'Reactivar', title: 'Reactivar cuenta', confirm: 'Reactivar' },
  dismiss: { label: 'Descartar reportes', title: 'Descartar reportes', confirm: 'Descartar' },
};

/** Botón de una acción de moderación: pide el motivo (HU-012) y avisa al terminar. */
export function ModerationActionButton({
  action,
  onDone,
}: {
  action: ModerationAction;
  onDone: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const copy = COPY[action.kind];
  const target =
    'opportunityId' in action
      ? action.opportunityId
      : 'userId' in action
        ? action.userId
        : action.targetId;
  const id = `accion-${action.kind}-${target}`;
  const danger = action.kind === 'hide' || action.kind === 'block' || action.kind === 'suspend';
  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        className={`min-h-11 rounded-field border px-3 text-sm font-bold ${danger ? 'border-danger text-danger' : 'border-line'}`}
      >
        {copy.label}
      </button>
      <ReasonDialog
        open={open}
        title={copy.title}
        confirmLabel={copy.confirm}
        returnFocusId={id}
        onClose={() => setOpen(false)}
        onConfirm={async (reason) => {
          const result = await adminApi.moderate(action, reason).catch(() => null);
          if (!result) return 'No pudimos guardar la acción. Inténtalo de nuevo.';
          const error = adminResultMessage(result);
          if (!error) onDone(`${copy.title}: listo.`);
          return error;
        }}
      />
    </>
  );
}
