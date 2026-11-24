'use client';

import { useState } from 'react';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { adminApi } from '@/lib/api';
import { AdminStates, formatDateTime, Pager } from './admin-states';
import { useAdminData } from './use-admin-data';

const PAGE_SIZE = 20;
export const ACTION_TEXT: Record<string, string> = {
  ADMIN_LOGIN: 'Inicio de sesión de administrador',
  ADMIN_ACCESS_DENIED: 'Acceso denegado al panel',
  USER_SUSPENDED: 'Cuenta suspendida',
  USER_BLOCKED: 'Cuenta bloqueada',
  USER_REACTIVATED: 'Cuenta reactivada',
  OPPORTUNITY_HIDDEN: 'Publicación ocultada',
  OPPORTUNITY_UNHIDDEN: 'Publicación visible de nuevo',
  REPORT_DISMISSED: 'Reportes descartados',
  CATEGORY_CREATED: 'Categoría creada',
  CATEGORY_UPDATED: 'Categoría modificada',
  LABOR_RULE_UPDATED: 'Regla laboral modificada',
  TERMS_ACCEPTED: 'Términos aceptados',
  AGREEMENT_ACCEPTED: 'Acuerdo de trabajo aceptado',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Convierte una fecha del filtro (AAAA-MM-DD) al inicio o fin de ese día en hora de Colombia. */
export const dayBound = (day: string, end: boolean) =>
  `${day}T${end ? '23:59:59' : '00:00:00'}-05:00`;

/** HU-038 CA2 y CA3: consulta de solo lectura, sin editar ni borrar. */
export function AuditPanel() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [page, setPage] = useState(1);
  const actorValid = actor === '' || UUID.test(actor.trim());
  const { state, reload } = useAdminData(() => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (from) query.set('from', new Date(dayBound(from, false)).toISOString());
    if (to) query.set('to', new Date(dayBound(to, true)).toISOString());
    if (action) query.set('action', action);
    if (actor && actorValid) query.set('actorUserId', actor.trim());
    return adminApi.audit(query);
  }, [from, to, action, actorValid ? actor : '', page]);
  const reset = () => setPage(1);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-bold">Auditoría</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Desde"
          type="date"
          value={from}
          onChange={(e) => (setFrom(e.target.value), reset())}
        />
        <Field
          label="Hasta"
          type="date"
          value={to}
          onChange={(e) => (setTo(e.target.value), reset())}
        />
        <Select
          label="Tipo de evento"
          value={action}
          onChange={(e) => (setAction(e.target.value), reset())}
        >
          <option value="">Todos</option>
          {Object.entries(ACTION_TEXT).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Field
          label="Usuario (identificador)"
          value={actor}
          onChange={(e) => (setActor(e.target.value), reset())}
          error={actorValid ? undefined : 'Pega el identificador completo del usuario.'}
        />
      </div>
      <AdminStates
        state={state}
        reload={reload}
        isEmpty={(data) => data.items.length === 0}
        empty="No hay eventos con estos filtros."
      >
        {(data) => (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3">Fecha y hora</th>
                    <th className="py-2 pr-3">Evento</th>
                    <th className="py-2 pr-3">Usuario</th>
                    <th className="py-2 pr-3">Objetivo</th>
                    <th className="py-2 pr-3">Motivo</th>
                    <th className="py-2">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((log) => (
                    <tr key={log.id} className="border-b border-line align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="py-2 pr-3">{ACTION_TEXT[log.action] ?? log.action}</td>
                      <td className="py-2 pr-3 font-mono text-xs" title={log.actorUserId ?? ''}>
                        {log.actorUserId ? `${log.actorUserId.slice(0, 8)}…` : '—'}
                      </td>
                      <td className="py-2 pr-3">
                        {log.targetType ? `${log.targetType} ${log.targetId ?? ''}` : '—'}
                      </td>
                      <td className="py-2 pr-3">{log.reason ?? '—'}</td>
                      <td className="py-2 font-mono text-xs">{log.ip ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </AdminStates>
    </section>
  );
}
