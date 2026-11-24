'use client';

import { useEffect, useState } from 'react';
import { ReputationSummary } from '@/components/profiles/reputation-summary';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ratingsApi, type MyRatings, type ReceivedRating } from '@/lib/api';
import { REPUTATION_DIMENSIONS } from '@/lib/api/reputation';
import { formatDate } from '@/lib/format';

const PAGE_SIZE = 10;

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: MyRatings; items: ReceivedRating[] };

function RatingItem({ rating }: { rating: ReceivedRating }) {
  return (
    <li className="flex flex-col gap-2 rounded-[20px] border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-dark">
          {rating.rateeRole === 'WORKER' ? 'Como trabajador' : 'Como publicador'}
        </span>
        <span className="text-xs text-muted">{formatDate(rating.publishedAt)}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
        {REPUTATION_DIMENSIONS.map(({ key, label }) => (
          <div key={key} className="flex justify-between gap-2">
            <dt>{label}</dt>
            <dd className="font-bold">{rating[key]} de 5</dd>
          </div>
        ))}
      </dl>
      {/* Texto de otro usuario: siempre como texto plano. */}
      {rating.comment ? (
        <p className="text-[14px] break-words whitespace-pre-wrap">“{rating.comment}”</p>
      ) : null}
    </li>
  );
}

/** Mi reputación (HU-046, HU-013 CA3): en cada rol y calificaciones recibidas. */
export function MyReputation() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);

  useEffect(() => {
    let active = true;
    ratingsApi
      .getMyRatings(1, PAGE_SIZE)
      .then((data) => {
        if (active) setState({ status: 'ready', data, items: data.ratings.items });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, []);

  async function loadMore() {
    if (state.status !== 'ready' || loadingMore) return;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const next = await ratingsApi.getMyRatings(page + 1, PAGE_SIZE);
      setPage(page + 1);
      setState({ ...state, data: next, items: [...state.items, ...next.ratings.items] });
    } catch {
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <p role="status" className="text-[15px] text-muted">
        Cargando tu reputación…
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <Alert tone="danger" role="alert">
        No pudimos cargar tu reputación. Recarga la página para intentarlo de nuevo.
      </Alert>
    );
  }

  const { data, items } = state;
  const hasMore = items.length < data.ratings.total;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl leading-tight font-bold">Mi reputación</h1>
      <ReputationSummary reputation={data.worker} title="Como trabajador" />
      <ReputationSummary reputation={data.publisher} title="Como publicador" />

      <section aria-labelledby="calificaciones-recibidas" className="flex flex-col gap-3">
        <h2 id="calificaciones-recibidas" className="font-display text-2xl font-bold">
          Calificaciones recibidas
        </h2>
        {items.length === 0 ? (
          <p className="text-[15px] text-muted">
            Aún no tienes calificaciones publicadas. Se publican cuando ambas partes califican o
            pasan 7 días.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((rating) => (
              <RatingItem key={rating.id} rating={rating} />
            ))}
          </ul>
        )}
        {moreFailed ? (
          <Alert tone="danger" role="alert">
            No pudimos cargar más calificaciones. Inténtalo de nuevo.
          </Alert>
        ) : null}
        {hasMore ? (
          <Button variant="secondary" aria-disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? 'Cargando…' : 'Ver más calificaciones'}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
