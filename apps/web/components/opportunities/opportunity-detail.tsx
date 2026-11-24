'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { labels } from '@/components/activity/activity-ui';
import { ReportButton } from '@/components/reports/report-button';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { opportunitiesApi } from '@/lib/api';
import type { ApplicationResult, Opportunity } from '@/lib/api/opportunities';
import { formatBogotaDateTime } from '@/lib/dates';
import { formatCop } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import { useCurrentUser } from '@/lib/session/use-current-user';

const MAX_MESSAGE = 1000;
const label = (key: string | null | undefined) =>
  key ? ((labels as Record<string, string>)[key] ?? key) : '';

/** Mensaje para cada resultado de postularse (HU-005). `null` si se postuló. */
export const applyMessage = (result: ApplicationResult): string | null => {
  switch (result.status) {
    case 'applied':
      return null;
    case 'already_applied':
      return 'Ya te postulaste a esta oportunidad.';
    case 'closed':
      return 'Esta oportunidad ya no recibe postulaciones.';
    case 'no_worker_profile':
      return 'Necesitas un perfil de trabajador para postularte.';
    case 'email_not_confirmed':
      return 'Confirma tu correo antes de postularte.';
    case 'own_opportunity':
      return 'No puedes postularte a tu propia publicación.';
    case 'not_found':
      return 'Esta oportunidad ya no está disponible.';
    case 'rate_limited':
      return 'Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
    case 'invalid':
      return Object.values(result.errors).flat()[0] ?? 'Revisa el mensaje.';
  }
};

const hours = (minutes: number) =>
  minutes % 60 === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

/** HU-026 y HU-005: detalle público de una oportunidad y postulación. */
export function OpportunityDetail({ id }: { id: string }) {
  const router = useRouter();
  const session = useCurrentUser();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'not_found' }
    | { status: 'error' }
    | { status: 'ready'; opportunity: Opportunity }
  >({ status: 'loading' });
  const [applied, setApplied] = useState(false);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [sending, setSending] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    opportunitiesApi
      .get(id)
      .then((result) => {
        if (!active) return;
        setState(
          result.status === 'found' ? { status: 'ready', opportunity: result.opportunity } : result,
        );
      })
      .catch(() => active && setState({ status: 'error' }));
    opportunitiesApi
      .applicationStatus([id])
      .then((statuses) => active && setApplied(Boolean(statuses[id])))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [id, attempt]);

  if (state.status === 'loading')
    return (
      <p role="status" className="text-muted">
        Cargando oportunidad…
      </p>
    );
  if (state.status === 'not_found')
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="info">Esta oportunidad ya no está disponible.</Alert>
        <Link href={ROUTES.work} className="font-bold text-brand underline">
          Volver a las oportunidades
        </Link>
      </div>
    );
  if (state.status === 'error')
    return (
      <Alert tone="danger" role="alert">
        No pudimos cargar la oportunidad.{' '}
        <button
          type="button"
          className="font-bold underline"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Reintentar
        </button>
      </Alert>
    );

  const o = state.opportunity;
  const formal = o.type === 'FORMAL_JOB';
  const user = session.status === 'ready' ? session.user : null;
  const isOwner = Boolean(user?.publisherProfileId && o.publisher?.id === user.publisherProfileId);
  const open = o.status === 'ACTIVE';

  async function apply() {
    if (sending) return;
    if (message.length > MAX_MESSAGE) {
      setFeedback({ tone: 'danger', text: `El mensaje admite hasta ${MAX_MESSAGE} caracteres.` });
      return;
    }
    setSending(true);
    setFeedback(undefined);
    const result = await opportunitiesApi
      .apply(id, formal ? message.trim() || undefined : undefined)
      .catch(() => null);
    setSending(false);
    if (!result) {
      setFeedback({
        tone: 'danger',
        text: 'No pudimos enviar tu postulación. Inténtalo de nuevo.',
      });
      return;
    }
    if (result.status === 'applied' || result.status === 'already_applied') setApplied(true);
    if (result.status === 'no_worker_profile') return router.push(ROUTES.workerProfile);
    const error = applyMessage(result);
    setFeedback(
      error
        ? { tone: 'danger', text: error }
        : {
            tone: 'success',
            text: formal
              ? 'Te postulaste. La empresa revisará tu perfil.'
              : 'Listo, el publicador verá que te interesa.',
          },
    );
  }

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold text-muted uppercase">{label(o.type)}</p>
        <h1 className="font-display text-3xl leading-tight font-bold">{o.title}</h1>
        {!open ? (
          <Alert tone="warning">Esta oportunidad está {label(o.status).toLowerCase()}.</Alert>
        ) : null}
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Item term="Zona">{o.zone.name}</Item>
        <Item term="Categoría">{o.category.name}</Item>
        {formal ? (
          <>
            <Item term="Salario">
              {o.salaryMinCop
                ? o.salaryMaxCop && o.salaryMaxCop !== o.salaryMinCop
                  ? `${formatCop(o.salaryMinCop)} a ${formatCop(o.salaryMaxCop)}`
                  : formatCop(o.salaryMinCop)
                : 'A convenir'}
            </Item>
            <Item term="Modalidad">{label(o.modality)}</Item>
            <Item term="Jornada">{label(o.schedule)}</Item>
            {o.closesAt ? <Item term="Cierra">{formatBogotaDateTime(o.closesAt)}</Item> : null}
          </>
        ) : (
          <>
            {o.paymentCop ? <Item term="Pago">{formatCop(o.paymentCop)}</Item> : null}
            {o.scheduledAt ? <Item term="Fecha">{formatBogotaDateTime(o.scheduledAt)}</Item> : null}
            {o.durationMinutes ? <Item term="Duración">{hours(o.durationMinutes)}</Item> : null}
            {o.peopleNeeded ? <Item term="Personas">{o.peopleNeeded}</Item> : null}
          </>
        )}
      </dl>

      <Section title="Descripción">{o.description}</Section>
      {o.conditions ? <Section title="Condiciones">{o.conditions}</Section> : null}
      {o.experienceRequired ? <Section title="Experiencia">{o.experienceRequired}</Section> : null}
      {o.requirements ? <Section title="Requisitos">{o.requirements}</Section> : null}

      <p className="text-sm text-muted">
        La dirección exacta solo se comparte con la persona seleccionada, después de aceptar el
        trabajo.
      </p>

      {o.publisher ? (
        <Link
          href={`/publicadores/${encodeURIComponent(o.publisher.id)}`}
          className="flex min-h-11 items-center gap-3 rounded-card border border-line p-3 font-bold"
        >
          Publicado por {o.publisher.displayName}
        </Link>
      ) : null}

      <div aria-live="polite">
        {feedback ? <Alert tone={feedback.tone}>{feedback.text}</Alert> : null}
      </div>

      {isOwner ? (
        <Link href={ROUTES.activity} className="font-bold text-brand underline">
          Es tu publicación: verla en Mi actividad
        </Link>
      ) : applied ? (
        <Alert tone="success">Ya te postulaste a esta oportunidad.</Alert>
      ) : open ? (
        <div className="flex flex-col gap-3">
          {formal ? (
            <Textarea
              label="Mensaje para la empresa (opcional)"
              value={message}
              maxLength={MAX_MESSAGE}
              onChange={(event) => setMessage(event.target.value)}
              hint={`${message.length}/${MAX_MESSAGE} caracteres`}
            />
          ) : null}
          <Button aria-disabled={sending} onClick={() => void apply()}>
            {sending ? 'Enviando…' : formal ? 'Postularme' : 'Me interesa'}
          </Button>
        </div>
      ) : null}

      {!isOwner ? (
        <ReportButton
          targetType="OPPORTUNITY"
          targetId={o.id}
          onReported={() => window.setTimeout(() => router.push(ROUTES.work), 1500)}
        />
      ) : null}
    </article>
  );
}

function Item({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line p-3">
      <dt className="text-xs text-muted">{term}</dt>
      <dd className="font-bold">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="whitespace-pre-line">{children}</p>
    </section>
  );
}
