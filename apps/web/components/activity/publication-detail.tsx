'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { activityApi, type OwnedOpportunity } from '@/lib/api';
import { ActivityScreen, card, labels, Problem, Resource, useAction } from './activity-ui';
import { Applicants } from './applicants';
import { PublicationEditor } from './publication-editor';

export function PublicationDetail({ id }: { id: string }) {
  const load = useCallback(() => activityApi.own(id), [id]);
  const [notice, setNotice] = useState('');
  return (
    <ActivityScreen title="Gestionar publicación">
      <p role="status">{notice}</p>
      <Resource load={load}>
        {(p, reload) => (
          <Manage
            publication={p}
            onSaved={(message) => {
              setNotice(message);
              reload();
            }}
            reload={reload}
          />
        )}
      </Resource>
    </ActivityScreen>
  );
}
function Manage({
  publication: p,
  onSaved,
  reload,
}: {
  publication: OwnedOpportunity;
  onSaved: (message: string) => void;
  reload: () => void;
}) {
  const editable = p.status === 'ACTIVE' || p.status === 'PAUSED';
  const canCancel = editable || p.status === 'CLOSED';
  const [edit, setEdit] = useState(false);
  const [action, setAction] = useState<'pause' | 'close' | 'cancel' | 'resume' | ''>('');
  const [reason, setReason] = useState('');
  const [address, setAddress] = useState(p.exactAddress ?? '');
  const { run, busy, error, fieldErrors } = useAction();
  return (
    <>
      <article className={card}>
        <h2 className="font-display text-xl font-bold">{p.title}</h2>
        <p>
          {labels[p.type]} · {labels[p.status]} · {p.zone.name}
        </p>
        <p>{p.description}</p>
        {p.statusReason && <p>Motivo: {p.statusReason}</p>}
        {p.hiddenAt && <p>Oculta por moderación. {p.hiddenReason}</p>}
      </article>
      {editable && (
        <Button variant="secondary" aria-expanded={edit} onClick={() => setEdit(!edit)}>
          {edit ? 'Cerrar edición' : 'Editar publicación'}
        </Button>
      )}
      {edit && (
        <PublicationEditor publication={p} onSaved={() => onSaved('Publicación actualizada.')} />
      )}
      {canCancel && (
        <form
          className={card}
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!action) return;
              if (action === 'resume') await activityApi.resume(p.id);
              else await activityApi.changeStatus(p.id, action, reason.trim());
              onSaved('Estado actualizado.');
            });
          }}
        >
          <Select
            label="Cambiar estado de la publicación"
            value={action}
            disabled={busy}
            onChange={(e) => setAction(e.target.value as typeof action)}
          >
            <option value="">Elige una acción</option>
            {p.status === 'ACTIVE' && <option value="pause">Pausar</option>}
            {p.status === 'PAUSED' && <option value="resume">Reactivar</option>}
            {editable && <option value="close">Cerrar</option>}
            <option value="cancel">Cancelar</option>
          </Select>
          {action && action !== 'resume' && (
            <Textarea
              label="Motivo"
              error={fieldErrors?.reason?.[0]}
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
          <Button
            type="submit"
            disabled={busy || !action || (action !== 'resume' && reason.trim().length < 5)}
          >
            Confirmar cambio de estado
          </Button>
        </form>
      )}
      {canCancel && p.type !== 'FORMAL_JOB' && (
        <form
          className={card}
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await activityApi.address(p.id, address.trim());
              onSaved('Dirección actualizada.');
            });
          }}
        >
          <Field
            label="Dirección exacta"
            error={fieldErrors?.address?.[0]}
            hint="Solo la verán las personas que acepten el trabajo. Deja el campo vacío para borrarla."
            maxLength={300}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={busy || address.trim() === (p.exactAddress ?? '')}
          >
            Guardar dirección
          </Button>
        </form>
      )}
      {error ? <Problem error={error} retry={reload} /> : null}
      <Applicants id={p.id} formal={p.type === 'FORMAL_JOB'} open={p.status === 'ACTIVE'} />
    </>
  );
}
