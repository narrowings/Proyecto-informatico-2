import type { AuthApi } from './auth';
import { mockAuthApi } from './auth.mock';
import type { CatalogsApi } from './catalogs';
import { mockCatalogsApi } from './catalogs.mock';
import type { ProfilesApi } from './profiles';
import { mockProfilesApi } from './profiles.mock';
import type { SessionApi } from './session';
import { mockSessionApi } from './session.mock';

/** Puntos únicos de acceso a la API; cambiar aquí por los clientes reales. */
export const authApi: AuthApi = mockAuthApi;
export const sessionApi: SessionApi = mockSessionApi;
export const profilesApi: ProfilesApi = mockProfilesApi;
export const catalogsApi: CatalogsApi = mockCatalogsApi;

export type * from './auth';
export type * from './catalogs';
export type * from './profiles';
export type * from './session';
