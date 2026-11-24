'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Select } from '@/components/ui/select';
import { LogoutButton } from '@/components/auth/logout-button';
import { activityApi, type JobRole, type JobState } from '@/lib/api';
import {
  MY_REPUTATION_PATH,
  ROUTES,
  jobDetailPath,
  publicationPath,
  selectionDetailPath,
} from '@/lib/routes';
import {
  card,
  heading,
  jobLabel,
  labels,
  linkStyle,
  dateTime,
  PagedList,
  Resource,
} from './activity-ui';

export function ActivityDashboard() {
  const [section, setSection] = useState('applications');
  return (
    <div className="flex flex-col gap-5">
      <h1 className={heading}>Mi actividad</h1>
      <Select label="Consultar" value={section} onChange={(e) => setSection(e.target.value)}>
        <option value="applications">Mis postulaciones</option>
        <option value="publications">Mis publicaciones</option>
        <option value="selections">Mis selecciones</option>
        <option value="jobs">Mis trabajos</option>
      </Select>
      {section === 'applications' && <Applications />}
      {section === 'publications' && <Publications />}
      {section === 'selections' && (
        <Resource load={activityApi.selections}>
          {(items) =>
            items.length ? (
              <ul className="flex flex-col gap-3">
                {items.map((s) => (
                  <li key={s.id} className={card}>
                    <Link className={linkStyle} href={selectionDetailPath(s.id)}>
                      {s.opportunity.title}
                    </Link>
                    <p>Responde antes del {dateTime(s.expiresAt)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={card}>No tienes selecciones pendientes.</p>
            )
          }
        </Resource>
      )}
      {section === 'jobs' && <Jobs />}
      <Link className={linkStyle} href={MY_REPUTATION_PATH}>
        Ver mi reputación y calificaciones
      </Link>
      <LogoutButton />
    </div>
  );
}
function Applications() {
  const [state, setState] = useState<'active' | 'all'>('active');
  const [page, setPage] = useState(1);
  const load = useCallback(() => activityApi.applications(state, page), [state, page]);
  return (
    <>
      <Select
        label="Postulaciones"
        value={state}
        onChange={(e) => {
          setPage(1);
          setState(e.target.value === 'all' ? 'all' : 'active');
        }}
      >
        <option value="active">Activas</option>
        <option value="all">Todas</option>
      </Select>
      <Resource load={load}>
        {(data) => (
          <PagedList
            data={data}
            empty={
              <>
                No tienes postulaciones en esta vista.{' '}
                <Link className={linkStyle} href={ROUTES.work}>
                  Explorar oportunidades
                </Link>
              </>
            }
            changePage={setPage}
          >
            {(a) => (
              <>
                <h2 className="font-bold">{a.opportunity?.title ?? 'Oportunidad no disponible'}</h2>
                <p>
                  {labels[a.status]} · {dateTime(a.createdAt)}
                </p>
                {a.opportunity && (
                  <p>
                    {a.opportunity.zone.name} · {labels[a.opportunity.status]}
                  </p>
                )}
              </>
            )}
          </PagedList>
        )}
      </Resource>
    </>
  );
}
function Publications() {
  const [page, setPage] = useState(1);
  const load = useCallback(() => activityApi.publications(page), [page]);
  return (
    <Resource load={load}>
      {(data) => (
        <PagedList
          data={data}
          empty={
            <>
              Aún no tienes publicaciones.{' '}
              <Link className={linkStyle} href={ROUTES.publish}>
                Publicar una necesidad
              </Link>
            </>
          }
          changePage={setPage}
        >
          {(p) => (
            <>
              <span className="text-xs font-bold text-muted">
                {labels[p.type]} · {labels[p.status]}
              </span>
              <Link href={publicationPath(p.id)} className={linkStyle}>
                {p.title}
              </Link>
              {p.statusReason && <p>{p.statusReason}</p>}
              <p>
                Interesados: {p.applicantsCount} · Aceptados: {p.acceptedCount}
              </p>
            </>
          )}
        </PagedList>
      )}
    </Resource>
  );
}
function Jobs() {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<JobRole>('worker');
  const [state, setState] = useState<JobState>('active');
  const load = useCallback(() => activityApi.jobs(role, state, page), [role, state, page]);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Select
          label="Mi rol"
          value={role}
          onChange={(e) => {
            setPage(1);
            setRole(e.target.value === 'worker' ? 'worker' : 'publisher');
          }}
        >
          <option value="worker">Trabajador</option>
          <option value="publisher">Publicador</option>
        </Select>
        <Select
          label="Trabajos"
          value={state}
          onChange={(e) => {
            setPage(1);
            setState(e.target.value === 'active' ? 'active' : 'finished');
          }}
        >
          <option value="active">Activos</option>
          <option value="finished">Finalizados</option>
        </Select>
      </div>
      <Resource load={load}>
        {(data) => (
          <PagedList data={data} empty="No tienes trabajos en esta vista." changePage={setPage}>
            {(j) => (
              <>
                <Link href={jobDetailPath(j.id)} className={linkStyle}>
                  {j.title}
                </Link>
                <p>
                  {jobLabel(j.status)} · {j.zone.name}
                </p>
                <p>
                  {dateTime(j.scheduledAt)}
                  {j.counterparty.name && ' · ' + j.counterparty.name}
                </p>
              </>
            )}
          </PagedList>
        )}
      </Resource>
    </>
  );
}
