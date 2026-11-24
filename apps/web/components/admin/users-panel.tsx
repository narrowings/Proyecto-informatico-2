'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { adminApi } from '@/lib/api';
import type { AccountStatus, AdminUser, ModerationAction } from '@/lib/api/admin';
import { AccountBadge, AdminStates, formatDateTime, Pager } from './admin-states';
import { ModerationActionButton } from './moderation-action';
import { useAdminData } from './use-admin-data';

const PAGE_SIZE = 20;

/** Acciones posibles según el estado de la cuenta (HU-012 CA3). Nunca sobre administradores. */
export const actionsFor = (user: AdminUser): ModerationAction['kind'][] => {
  if (user.role === 'ADMIN') return [];
  if (user.status === 'ACTIVE') return ['suspend', 'block'];
  if (user.status === 'SUSPENDED') return ['block', 'reactivate'];
  if (user.status === 'BLOCKED') return ['reactivate'];
  return [];
};

export function UsersPanel() {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | AccountStatus>('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string>();
  // Espera 300 ms después de escribir para no consultar en cada tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [text]);
  const { state, reload } = useAdminData(() => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q) query.set('q', q);
    if (status) query.set('status', status);
    return adminApi.users(query);
  }, [q, status, page]);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-bold">Usuarios</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Buscar por nombre o correo"
          value={text}
          maxLength={100}
          onChange={(event) => setText(event.target.value)}
        />
        <Select
          label="Estado"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as '' | AccountStatus);
            setPage(1);
          }}
        >
          <option value="">Todos</option>
          <option value="ACTIVE">Activa</option>
          <option value="SUSPENDED">Suspendida</option>
          <option value="BLOCKED">Bloqueada</option>
          <option value="PENDING_CONFIRMATION">Sin confirmar</option>
        </Select>
      </div>
      <div aria-live="polite">{notice ? <Alert tone="success">{notice}</Alert> : null}</div>
      <AdminStates
        state={state}
        reload={reload}
        isEmpty={(data) => data.items.length === 0}
        empty="No encontramos usuarios con esa búsqueda."
      >
        {(data) => (
          <>
            <ul className="flex flex-col gap-3">
              {data.items.map((user) => (
                <li key={user.id} className="rounded-card border border-line p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{user.name}</strong>
                    <AccountBadge status={user.status} />
                    {user.role === 'ADMIN' ? (
                      <span className="text-xs font-bold text-muted">Administrador</span>
                    ) : null}
                  </div>
                  <p className="text-sm">{user.email}</p>
                  <p className="text-xs text-muted">Registro: {formatDateTime(user.createdAt)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {actionsFor(user).map((kind) => (
                      <ModerationActionButton
                        key={kind}
                        action={{ kind, userId: user.id } as ModerationAction}
                        onDone={(message) => {
                          setNotice(message);
                          reload();
                        }}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </AdminStates>
    </section>
  );
}
