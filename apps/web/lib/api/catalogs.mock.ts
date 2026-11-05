import type { CatalogsApi, Category, Zone } from './catalogs';
import { wait } from './mock-state';

/*
 * Catálogos PROVISIONALES. Los oficiales los entrega José Alejandro (lista de la
 * Fase 0) y los carga Santiago López como datos semilla en T-03.
 */

const ZONES: Zone[] = [
  { id: 1, name: 'Norte' },
  { id: 2, name: 'Sur' },
  { id: 3, name: 'Oriente' },
  { id: 4, name: 'Oeste' },
  { id: 5, name: 'Centro' },
  { id: 6, name: 'Ladera' },
];

const CATEGORIES: Category[] = [
  { id: 1, name: 'Trasteos y logística' },
  { id: 2, name: 'Eventos' },
  { id: 3, name: 'Reparaciones del hogar' },
  { id: 4, name: 'Limpieza' },
  { id: 5, name: 'Tecnología' },
  { id: 6, name: 'Edición de video y fotografía' },
  { id: 7, name: 'Atención al cliente y ventas' },
  { id: 8, name: 'Cocina y alimentos' },
];

export const mockCatalogsApi: CatalogsApi = {
  async listZones() {
    await wait(150);
    return ZONES;
  },
  async listCategories() {
    await wait(150);
    return CATEGORIES;
  },
};
