'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Select } from '@/components/ui/select';
import { adminApi } from '@/lib/api';
import type {
  ModerationTargetType,
  ReportDetail,
  ReportGroup,
  ReportStatus,
} from '@/lib/api/admin';
import { AccountBadge, AdminStates, formatDateTime, Pager } from './admin-states';
import { ModerationActionButton } from './moderation-action';
import { useAdminData } from './use-admin-data';

const PAGE_SIZE = 10;
export const REASON_TEXT: Record<string, string> = {
  FRAUD: 'Fraude o estafa',
  INAPPROPRIATE: 'Contenido inapropiado',
  SPAM: 'Spam',
  OTHER: 'Otro',
};

/** HU-012 CA1: cola de reportes agrupados por elemento. */
export function ReportsPanel() {
  const [status, setStatus] = useState<ReportStatus>('PENDING');
  const [type, setType] = useState<'' | ModerationTargetType>('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string>();
  const { state, reload } = useAdminData(() => {
    const query = new URLSearchParams({ status, page: String(page), pageSize: String(PAGE_SIZE) });
    if (type) query.set('targetType', type);
    return adminApi.reports(query);
  }, [status, type, page]);
  const done = (message: string) => {
    setNotice(message);
    reload();
  };
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-bold">Reportes</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Estado"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ReportStatus);
            setPage(1);
          }}
        >
          <option value="PENDING">Pendientes</option>
          <option value="ACTIONED">Atendidos</option>
          <option value="DISMISSED">Descartados</option>
        </Select>
        <Select
          label="Tipo"
          value={type}
          onChange={(event) => {
            setType(event.target.value as '' | ModerationTargetType);
            setPage(1);
          }}
        >
          <option value="">Todos</option>
          <option value="OPPORTUNITY">Publicaciones</option>
          <option value="USER">Usuarios</option>
        </Select>
      </div>
      <div aria-live="polite">{notice ? <Alert tone="success">{notice}</Alert> : null}</div>
      <AdminStates
        state={state}
        reload={reload}
        isEmpty={(data) => data.items.length === 0}
        empty="No hay reportes con estos filtros."
      >
        {(data) => (
          <>
            <ul className="flex flex-col gap-3">
              {data.items.map((group) => (
                <ReportCard
                  key={`${group.targetType}-${group.targetId}`}
                  group={group}
                  pending={status === 'PENDING'}
                  onDone={done}
                />
              ))}
            </ul>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </AdminStates>
    </section>
  );
}

function ReportCard({
  group,
  pending,
  onDone,
}: {
  group: ReportGroup;
  pending: boolean;
  onDone: (message: string) => void;
}) {
  const [detail, setDetail] = useState<ReportDetail | 'loading' | 'error'>();
  const target = group.target;
  const isOpportunity = group.targetType === 'OPPORTUNITY';
  const hidden = Boolean(target?.hiddenAt);
  return (
    <li className="rounded-card border border-line p-4">
      <p className="text-xs font-bold text-muted uppercase">
        {isOpportunity ? 'Publicación' : 'Usuario'}
      </p>
      <h3 className="text-lg font-bold">
        {isOpportunity
          ? (target?.title ?? 'Publicación eliminada')
          : (target?.name ?? 'Cuenta eliminada')}
      </h3>
      {!isOpportunity && target ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {target.email} {target.status ? <AccountBadge status={target.status} /> : null}
        </p>
      ) : null}
      {isOpportunity && hidden ? (
        <p className="text-sm text-danger">Oculta: {target?.hiddenReason}</p>
      ) : null}
      <p className="mt-2 text-sm">
        <strong>{group.reportCount}</strong> {group.reportCount === 1 ? 'reporte' : 'reportes'} ·{' '}
        {Object.entries(group.reasons)
          .map(([reason, count]) => `${REASON_TEXT[reason] ?? reason} (${count})`)
          .join(', ')}
      </p>
      <p className="text-xs text-muted">
        Primero: {formatDateTime(group.firstReportedAt)} · Último:{' '}
        {formatDateTime(group.lastReportedAt)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-field border border-line px-3 text-sm font-bold"
          aria-expanded={detail !== undefined && detail !== 'loading'}
          onClick={() => {
            if (detail && detail !== 'loading') return setDetail(undefined);
            setDetail('loading');
            adminApi
              .reportDetail(group.targetType, group.targetId)
              .then(setDetail)
              .catch(() => setDetail('error'));
          }}
        >
          Ver detalle
        </button>
        {isOpportunity && target ? (
          <ModerationActionButton
            action={{ kind: hidden ? 'unhide' : 'hide', opportunityId: group.targetId }}
            onDone={onDone}
          />
        ) : null}
        {!isOpportunity && target && target.role !== 'ADMIN' && target.status !== 'BLOCKED' ? (
          <ModerationActionButton
            action={{ kind: 'block', userId: group.targetId }}
            onDone={onDone}
          />
        ) : null}
        {pending ? (
          <ModerationActionButton
            action={{ kind: 'dismiss', targetType: group.targetType, targetId: group.targetId }}
            onDone={onDone}
          />
        ) : null}
      </div>
      {detail === 'loading' ? <p className="mt-3 text-sm">Cargando detalle…</p> : null}
      {detail === 'error' ? (
        <p className="mt-3 text-sm text-danger">No pudimos cargar el detalle.</p>
      ) : null}
      {detail && typeof detail === 'object' ? (
        <ul className="mt-3 flex flex-col gap-2 border-t border-line pt-3 text-sm">
          {detail.reports.map((report, index) => (
            <li key={index}>
              <strong>{REASON_TEXT[report.reason] ?? report.reason}</strong> ·{' '}
              {formatDateTime(report.createdAt)}
              {report.description ? <p className="text-muted">{report.description}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
