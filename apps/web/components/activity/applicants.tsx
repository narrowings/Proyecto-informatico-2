'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Avatar } from '@/components/profiles/avatar';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  activityApi,
  type Candidate,
  type CandidateStatus,
  type Applicants as ApplicantList,
} from '@/lib/api';
import { absolutePhotoUrl } from '@/lib/api/profiles.http';
import { formatRating } from '@/lib/format';
import { workerPublicPath } from '@/lib/routes';
import { card, labels, linkStyle, Problem, Resource, useAction } from './activity-ui';

function WorkerCard({ candidate }: { candidate: Candidate }) {
  const { worker } = candidate;
  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar size="md" name={worker.displayName} photoUrl={absolutePhotoUrl(worker.photoUrl)} />
        <Link className={linkStyle} href={workerPublicPath(candidate.workerProfileId)}>
          {worker.displayName}
        </Link>
      </div>
      <p>
        {worker.zone.name} · {worker.availability === 'AVAILABLE' ? 'Disponible' : 'No disponible'}
      </p>
      {worker.skills.length > 0 && <p>{worker.skills.join(', ')}</p>}
      <p>Postulación: {labels[candidate.status]}</p>
    </>
  );
}

const statuses: CandidateStatus[] = ['IN_REVIEW', 'INTERVIEW', 'ACCEPTED', 'REJECTED'];
function FormalCandidate({ candidate, reload }: { candidate: Candidate; reload: () => void }) {
  const { busy, run, error } = useAction();
  const [status, setStatus] = useState<CandidateStatus | ''>('');
  const terminal = ['ACCEPTED', 'REJECTED', 'WITHDRAWN'].includes(candidate.status);
  return (
    <li className={card}>
      <WorkerCard candidate={candidate} />
      {!terminal && (
        <>
          <Select
            label={'Cambiar estado de ' + candidate.worker.displayName}
            value={status}
            disabled={busy}
            onChange={(e) => setStatus(e.target.value as CandidateStatus)}
          >
            <option value="">Elige un estado</option>
            {statuses
              .filter((s) => s !== candidate.status)
              .map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
          </Select>
          <Button
            disabled={!status || busy}
            onClick={() =>
              run(async () => {
                if (status) {
                  await activityApi.changeCandidate(candidate.id, status);
                  reload();
                }
              })
            }
          >
            Guardar estado
          </Button>
        </>
      )}
      {error ? <Problem error={error} retry={reload} /> : null}
    </li>
  );
}
function TaskApplicants({
  id,
  data,
  open,
  reload,
}: {
  id: string;
  data: ApplicantList;
  open: boolean;
  reload: () => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const { run, busy, error } = useAction();
  const remaining = data.needed - data.selected;
  return (
    <>
      <p>
        {data.selected} de {data.needed} cupos seleccionados
      </p>
      <ul className="flex flex-col gap-3">
        {data.applicants.map((a) => (
          <li className={card} key={a.id}>
            <WorkerCard candidate={a} />
            <p>
              {a.reputation.average === null
                ? 'Nuevo en la plataforma'
                : formatRating(a.reputation.average) + ' de 5'}{' '}
              · Trabajos completados: {a.reputation.completedJobs}
            </p>
            {a.selectionStatus ? (
              <p>Selección: {labels[a.selectionStatus]}</p>
            ) : (
              open &&
              a.status === 'RECEIVED' && (
                <Checkbox
                  label={'Seleccionar a ' + a.worker.displayName}
                  checked={ids.includes(a.id)}
                  disabled={busy || (!ids.includes(a.id) && ids.length >= remaining)}
                  onChange={(e) =>
                    setIds(e.target.checked ? [...ids, a.id] : ids.filter((id) => id !== a.id))
                  }
                />
              )
            )}
          </li>
        ))}
      </ul>
      {!data.applicants.length && <p>Aún no hay interesados.</p>}
      {open && data.applicants.length > 0 && (
        <Button
          disabled={busy || !ids.length}
          onClick={() =>
            run(async () => {
              await activityApi.select(id, ids);
              reload();
            })
          }
        >
          Enviar selección ({ids.length})
        </Button>
      )}
      {error ? <Problem error={error} retry={reload} /> : null}
    </>
  );
}
export function Applicants({ id, formal, open }: { id: string; formal: boolean; open: boolean }) {
  const candidates = useCallback(() => activityApi.candidates(id), [id]);
  const applicants = useCallback(() => activityApi.applicants(id), [id]);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-bold">
        {formal ? 'Candidatos de la vacante' : 'Personas interesadas'}
      </h2>
      {formal ? (
        <Resource load={candidates}>
          {(data, reload) =>
            data.length ? (
              <ul className="flex flex-col gap-3">
                {data.map((c) => (
                  <FormalCandidate key={c.id} candidate={c} reload={reload} />
                ))}
              </ul>
            ) : (
              <p>Aún no hay candidatos.</p>
            )
          }
        </Resource>
      ) : (
        <Resource load={applicants}>
          {(data, reload) => <TaskApplicants id={id} data={data} open={open} reload={reload} />}
        </Resource>
      )}
    </section>
  );
}
