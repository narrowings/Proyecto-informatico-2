import type { AuthApi } from './auth';
import { mockAuthApi } from './auth.mock';

/** Punto único de acceso a la API de identidad; cambiar aquí por el cliente real. */
export const authApi: AuthApi = mockAuthApi;

export type * from './auth';
