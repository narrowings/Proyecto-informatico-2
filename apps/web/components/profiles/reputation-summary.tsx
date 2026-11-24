import { REPUTATION_DIMENSIONS, type Reputation } from '@/lib/api/reputation';
import { formatDate, formatRating } from '@/lib/format';

const jobs = (count: number) =>
  `${count} ${count === 1 ? 'trabajo completado' : 'trabajos completados'}`;

/**
 * Reputación (HU-046, HU-029 CA2–CA3): promedio general, detalle por
 * cumplimiento, puntualidad, comunicación y calidad, trabajos completados y
 * comentarios recientes. Sin calificaciones muestra "Nuevo en la plataforma".
 */
export function ReputationSummary({
  reputation,
  title = 'Reputación',
}: {
  reputation: Reputation;
  title?: string;
}) {
  const headingId = `reputacion-${title.toLowerCase().replace(/\W+/g, '-')}`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-[20px] border border-line bg-white p-4"
    >
      <h2 id={headingId} className="text-xs font-bold tracking-widest text-muted uppercase">
        {title}
      </h2>

      {reputation.isNew || reputation.average === null ? (
        <div className="flex flex-col gap-1">
          <p className="w-fit rounded-full bg-brand-soft px-3 py-1.5 text-[13px] font-bold text-brand-dark">
            Nuevo en la plataforma
          </p>
          <p className="text-[13px] text-muted">
            Aún no tiene calificaciones · {jobs(reputation.completedJobs)}
          </p>
        </div>
      ) : (
        <>
          <p className="flex items-baseline gap-2">
            <span className="font-display text-[34px] leading-none font-extrabold">
              {formatRating(reputation.average)}
            </span>
            <span className="text-[13px] text-muted">
              promedio de 5 · {reputation.ratingsCount}{' '}
              {reputation.ratingsCount === 1 ? 'calificación' : 'calificaciones'} ·{' '}
              {jobs(reputation.completedJobs)}
            </span>
          </p>

          <dl className="flex flex-col gap-2.5 text-[13px]">
            {REPUTATION_DIMENSIONS.map(({ key, label }) => {
              const value = reputation[key];
              return (
                <div key={key} className="flex items-center gap-2.5">
                  <dt className="w-26 shrink-0">{label}</dt>
                  <dd className="flex flex-1 items-center gap-2.5">
                    <span aria-hidden="true" className="h-2 flex-1 rounded-full bg-[#e3eae7]">
                      <span
                        className="block h-2 rounded-full bg-brand"
                        style={{ width: `${((value ?? 0) / 5) * 100}%` }}
                      />
                    </span>
                    <b className="w-7 text-right">{value === null ? '—' : formatRating(value)}</b>
                  </dd>
                </div>
              );
            })}
          </dl>
        </>
      )}

      {reputation.recentComments.some((comment) => comment.text) ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <h3 className="text-[13px] font-bold">Comentarios recientes</h3>
          <ul className="flex flex-col gap-2">
            {reputation.recentComments
              .filter((comment) => comment.text)
              .map((comment, index) => (
                <li key={index} className="flex flex-col gap-0.5">
                  {/* Texto de otros usuarios: siempre como texto plano. */}
                  <p className="text-[14px] break-words whitespace-pre-wrap">“{comment.text}”</p>
                  {comment.date ? (
                    <p className="text-xs text-muted">{formatDate(comment.date)}</p>
                  ) : null}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
