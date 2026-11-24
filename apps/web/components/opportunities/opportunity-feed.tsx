'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { opportunitiesApi } from '@/lib/api';
import type { OpportunityPage, OpportunityQuery } from '@/lib/api/opportunities';
import { useCatalogs } from '@/lib/catalogs/use-catalogs';
import { formatCop, formatDate } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import { labels } from '@/components/activity/activity-ui';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';

export function OpportunityFeed() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mode = search.get('modo') === 'formal' ? 'formal' : 'tasks';
  const catalogs = useCatalogs();
  const [text, setText] = useState('');
  const [queryText, setQueryText] = useState('');
  const [filters, setFilters] = useState<Omit<OpportunityQuery, 'mode'>>({});
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<OpportunityPage>();
  const [applied, setApplied] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQueryText(text);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [text]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setFailed(false);
    if (page === 1) setData(undefined);
    async function load() {
      try {
        const result = await opportunitiesApi.list({
          ...filters,
          mode,
          q: queryText || undefined,
          page,
          pageSize: 20,
        });
        const statuses = result.items.length
          ? await opportunitiesApi.applicationStatus(result.items.map((item) => item.id))
          : {};
        if (!active) return;
        setData((previous) => ({
          ...result,
          items: page === 1 ? result.items : [...(previous?.items ?? []), ...result.items],
        }));
        setApplied((previous) => (page === 1 ? statuses : { ...previous, ...statuses }));
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setBusy(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [mode, filters, queryText, page, revision]);
  function filter(next: typeof filters) {
    setFilters(next);
    setPage(1);
  }
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-bold">Oportunidades para ti</h1>
      <nav aria-label="Tipo de oportunidades" className="flex gap-2">
        {(['tasks', 'formal'] as const).map((value) => (
          <Button
            key={value}
            variant={mode === value ? 'primary' : 'secondary'}
            aria-pressed={mode === value}
            onClick={() => {
              filter({});
              const params = new URLSearchParams(search);
              params.set('modo', value);
              router.replace(`${pathname}?${params}`);
            }}
          >
            {value === 'tasks' ? 'Trabajos y tareas' : 'Empleo formal'}
          </Button>
        ))}
      </nav>
      <Field
        label="Buscar"
        maxLength={100}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {catalogs.status === 'ready' ? (
        <>
          {(['zones', 'categories'] as const).map((kind) => {
            const key = kind === 'zones' ? 'zoneId' : 'categoryId';
            return (
              <Select
                key={kind}
                label={kind === 'zones' ? 'Zona' : 'Categoría'}
                value={filters[key] ?? ''}
                onChange={(event) =>
                  filter({
                    ...filters,
                    [key]: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
              >
                <option value="">Todas</option>
                {catalogs[kind].map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            );
          })}
        </>
      ) : catalogs.status === 'error' ? (
        <Button onClick={catalogs.reload}>Reintentar catálogos</Button>
      ) : (
        <p role="status">Cargando filtros…</p>
      )}
      <Field
        label={mode === 'formal' ? 'Salario mínimo' : 'Pago mínimo'}
        type="number"
        min={0}
        step={1}
        value={(mode === 'formal' ? filters.salaryMin : filters.paymentMin) ?? ''}
        onChange={(event) =>
          filter({
            ...filters,
            [mode === 'formal' ? 'salaryMin' : 'paymentMin']: event.target.value
              ? Number(event.target.value)
              : undefined,
          })
        }
      />
      {mode === 'formal' ? (
        <Select
          label="Modalidad"
          value={filters.modality ?? ''}
          onChange={(event) =>
            filter({
              ...filters,
              modality: (event.target.value || undefined) as OpportunityQuery['modality'],
            })
          }
        >
          <option value="">Todas</option>
          {(['ONSITE', 'REMOTE', 'HYBRID'] as const).map((value) => (
            <option key={value} value={value}>
              {labels[value]}
            </option>
          ))}
        </Select>
      ) : (
        <Select
          label="Tipo"
          value={filters.type ?? ''}
          onChange={(event) =>
            filter({
              ...filters,
              type: (event.target.value || undefined) as OpportunityQuery['type'],
            })
          }
        >
          <option value="">Todos</option>
          {(['TASK', 'QUICK_JOB', 'PROJECT', 'SERVICE'] as const).map((value) => (
            <option key={value} value={value}>
              {labels[value]}
            </option>
          ))}
        </Select>
      )}
      <Button
        variant="secondary"
        onClick={() => {
          setText('');
          setQueryText('');
          filter({});
        }}
      >
        Limpiar filtros
      </Button>
      {busy && <p role="status">Cargando oportunidades…</p>}
      {failed && (
        <div role="alert">
          No pudimos cargar las oportunidades.
          <Button onClick={() => setRevision((value) => value + 1)}>Reintentar</Button>
        </div>
      )}
      {data && !data.items.length && <p>No hay oportunidades con estos filtros</p>}
      <ul className="flex flex-col gap-3">
        {data?.items.map((item) => (
          <li key={item.id}>
            <Link
              className="flex min-h-11 flex-col gap-2 rounded-card border border-line p-4 focus-visible:outline-3 focus-visible:outline-brand"
              href={ROUTES.opportunity(item.id)}
            >
              <span>{labels[item.type]}</span>
              <h2 className="text-xl font-bold">{item.title}</h2>
              {item.publisher && (
                <div>
                  {item.publisher.photoUrl && (
                    <img src={item.publisher.photoUrl} alt="" className="size-10 rounded-full" />
                  )}
                  {item.publisher.displayName}
                </div>
              )}
              <span>{item.zone.name}</span>
              <span>
                {item.type === 'FORMAL_JOB'
                  ? `${formatCop(item.salaryMinCop ?? 0)}${item.salaryMaxCop !== null ? ` – ${formatCop(item.salaryMaxCop)}` : ''}`
                  : formatCop(item.paymentCop ?? 0)}
              </span>
              {(item.closesAt || item.scheduledAt) && (
                <span>{formatDate((item.closesAt || item.scheduledAt)!)}</span>
              )}
              {Boolean(applied[item.id]) && <span>Ya te postulaste</span>}
            </Link>
          </li>
        ))}
      </ul>
      {data && data.items.length < data.total && (
        <Button disabled={busy} onClick={() => setPage((value) => value + 1)}>
          Cargar más
        </Button>
      )}
    </section>
  );
}
