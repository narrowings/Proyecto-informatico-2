'use client';

import { useCallback, useEffect, useState } from 'react';
import { catalogsApi, type Category, type Zone } from '@/lib/api';

export type CatalogsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; zones: Zone[]; categories: Category[] };

/** Zonas de Cali y categorías activas; `reload` reintenta tras un error. */
export function useCatalogs(): CatalogsState & { reload(): void } {
  const [state, setState] = useState<CatalogsState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([catalogsApi.listZones(), catalogsApi.listCategories()])
      .then(([zones, categories]) => {
        if (active) setState({ status: 'ready', zones, categories });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [revision]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setRevision((value) => value + 1);
  }, []);

  return { ...state, reload };
}
