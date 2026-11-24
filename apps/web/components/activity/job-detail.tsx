'use client';

import { useCallback, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { activityApi, type JobDetail as Job } from '@/lib/api';
import { rateJobPath } from '@/lib/routes';
import {
  ActivityScreen,
  card,
  dateTime,
  jobLabel,
  Problem,
  Resource,
  useAction,
} from './activity-ui';

export function JobDetail({ id }: { id: string }) {
  const load = useCallback(() => activityApi.job(id), [id]);
  return (
    <ActivityScreen title="Detalle del trabajo">
      <Resource load={load}>{(job, reload) => <JobActions job={job} reload={reload} />}</Resource>
    </ActivityScreen>
  );
}
function JobActions({ job, reload }: { job: Job; reload: () => void }) {
  const { run, busy, error, fieldErrors } = useAction();
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  return (
    <>
      <article className={card}>
        <h2 className="font-display text-xl font-bold">{job.title}</h2>
        <p>
          {jobLabel(job.status)} · {dateTime(job.scheduledAt)}
        </p>
        <p>{job.zone.name}</p>
      </article>
      <section className={card}>
        <h2 className="font-bold">Solo para este trabajo</h2>
        {job.counterparty?.name && <p>{job.counterparty.name}</p>}
        <p>Teléfono: {job.counterparty?.phone || 'Sin registrar'}</p>
        <p>Dirección: {job.exactAddress || 'Pendiente de registrar'}</p>
      </section>
      {job.status === 'CANCELLED' && (
        <p>
          {job.cancelledByMe ? 'Cancelaste el trabajo' : 'La otra parte canceló el trabajo'}.
          Motivo: {job.cancelReason}
        </p>
      )}
      {job.status === 'COMPLETED' &&
        (job.hasRated ? (
          <p>Ya calificaste este trabajo.</p>
        ) : (
          <ButtonLink href={rateJobPath(job.id)}>Calificar el trabajo</ButtonLink>
        ))}
      {job.status === 'IN_PROGRESS' &&
        (job.finishMarkedByMe ? (
          <p>La otra parte debe confirmar la finalización.</p>
        ) : (
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await activityApi.finish(job.id, job.finishMarkedAt ? 'confirm-finish' : 'finish');
                reload();
              })
            }
          >
            {job.finishMarkedAt ? 'Confirmar finalización' : 'Marcar como terminado'}
          </Button>
        ))}
      {job.status === 'SCHEDULED' &&
        (cancelling ? (
          <form
            className={card}
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await activityApi.cancelJob(job.id, reason.trim());
                reload();
              });
            }}
          >
            <Textarea
              label="Motivo de la cancelación"
              error={fieldErrors?.reason?.[0]}
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button type="submit" disabled={busy || reason.trim().length < 5}>
              Confirmar cancelación
            </Button>
            <Button disabled={busy} variant="secondary" onClick={() => setCancelling(false)}>
              Volver
            </Button>
          </form>
        ) : (
          <Button variant="secondary" onClick={() => setCancelling(true)}>
            Cancelar trabajo
          </Button>
        ))}
      {error ? <Problem error={error} retry={reload} /> : null}
    </>
  );
}
