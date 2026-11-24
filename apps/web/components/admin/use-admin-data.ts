'use client';

import { useCallback, useEffect, useState } from 'react';

export type AdminData<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

/** Carga datos del panel y permite recargarlos tras una acción o con "Reintentar". */
export function useAdminData<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<AdminData<T>>({ status: 'loading' });
  const run = useCallback(load, deps);
  const reload = useCallback(() => {
    let active = true;
    setState((current) => (current.status === 'ready' ? current : { status: 'loading' }));
    run()
      .then((data) => active && setState({ status: 'ready', data }))
      .catch(() => active && setState({ status: 'error' }));
    return () => {
      active = false;
    };
  }, [run]);
  useEffect(() => reload(), [reload]);
  return { state, reload };
}
