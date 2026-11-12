'use client';

import { useEffect, useState } from 'react';
import { sessionApi, type CurrentUser } from '@/lib/api';

export type CurrentUserState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; user: CurrentUser | null };

/** Usuario con sesión iniciada; `user: null` significa que no hay sesión. */
export function useCurrentUser(): CurrentUserState {
  const [state, setState] = useState<CurrentUserState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    sessionApi
      .getCurrentUser()
      .then((user) => {
        if (active) setState({ status: 'ready', user });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
