'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { activityApi, type OpportunityDetails, type PendingSelection } from '@/lib/api';
import { jobDetailPath } from '@/lib/routes';
import { ApiError } from '@/lib/api/http';
import { ActivityScreen, card, dateTime, pesos, Resource, Problem, useAction } from './activity-ui';

export function SelectionDetail({ id }: { id: string }) {
  const load = useCallback(async () => {
    const selection = (await activityApi.selections()).find((s) => s.id === id);
    if (!selection) return null;
    const opportunity = await activityApi
      .details(selection.opportunity.id)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      });
    return { selection, opportunity };
  }, [id]);
  return (
    <ActivityScreen title="Responder a la selección">
      <Resource load={load}>
        {(data) =>
          data ? (
            <Agreement {...data} />
          ) : (
            <p className={card}>Esta selección ya no está pendiente o venció.</p>
          )
        }
      </Resource>
    </ActivityScreen>
  );
}
function Agreement({
  selection,
  opportunity,
}: {
  selection: PendingSelection;
  opportunity: OpportunityDetails | null;
}) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [rejected, setRejected] = useState(false);
  const expiry = Date.parse(selection.expiresAt);
  const [remaining, setRemaining] = useState(() => Math.ceil((expiry - Date.now()) / 60000));
  const { run, busy, error } = useAction();
  useEffect(() => {
    const tick = () => setRemaining(Math.ceil((expiry - Date.now()) / 60000));
    const timer = setInterval(tick, 60000);
    const deadline = setTimeout(tick, Math.max(0, expiry - Date.now()));
    return () => {
      clearInterval(timer);
      clearTimeout(deadline);
    };
  }, [expiry]);
  if (rejected) return <p role="status">Rechazaste la selección.</p>;
  if (remaining <= 0) return <p role="status">El plazo para responder a la selección venció.</p>;
  return (
    <>
      {opportunity ? (
        <article className={card}>
          <h2 className="font-display text-xl font-bold">{opportunity.title}</h2>
          <p>{opportunity.description}</p>
          <p>
            {opportunity.zone.name}
            {opportunity.scheduledAt && ' · ' + dateTime(opportunity.scheduledAt)}
          </p>
          <p>
            Pago acordado: {pesos(opportunity.paymentCop ?? 0)} · Duración:{' '}
            {opportunity.durationMinutes} minutos
          </p>
          {opportunity.conditions && <p>Condiciones: {opportunity.conditions}</p>}
        </article>
      ) : (
        <p>La oportunidad ya no está disponible.</p>
      )}
      <p>
        Responde antes del {dateTime(selection.expiresAt)} (hora de Cali). Tiempo restante:{' '}
        {Math.floor(remaining / 60)} h {remaining % 60} min.
      </p>
      {opportunity?.status === 'ACTIVE' && (
        <>
          <p>Al aceptar, se registra el acuerdo de trabajo con estas condiciones.</p>
          <Checkbox
            label="Leí y acepto los términos de este trabajo"
            checked={accepted}
            disabled={busy}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <Button
            disabled={!accepted || busy}
            onClick={() =>
              run(async () => {
                if (Date.now() >= expiry) {
                  setRemaining(0);
                  return;
                }
                const job = await activityApi.accept(selection.id);
                router.replace(jobDetailPath(job.id));
              })
            }
          >
            Aceptar trabajo
          </Button>
        </>
      )}
      {error ? <Problem error={error} /> : null}
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() =>
          run(async () => {
            await activityApi.reject(selection.id);
            setRejected(true);
          })
        }
      >
        Rechazar selección
      </Button>
    </>
  );
}
