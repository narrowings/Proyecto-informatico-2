import type { CatalogsApi, Category, Zone } from './catalogs';
import { request } from './http';

// Públicos y sin cookies: el backend los sirve con caché de 5 minutos.
export const catalogsApi: CatalogsApi = {
  listZones: () => request<Zone[]>('/zones', { credentials: 'omit', cache: 'default' }),
  listCategories: () =>
    request<Category[]>('/categories', { credentials: 'omit', cache: 'default' }),
};
