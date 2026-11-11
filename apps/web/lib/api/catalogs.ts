/** Catálogos de zonas de Cali y categorías (T-03). Contrato provisional. */

export type Zone = { id: number; name: string };

export type Category = { id: number; name: string; description?: string };

export type CatalogsApi = {
  /** Solo zonas activas. */
  listZones(): Promise<Zone[]>;
  /** Solo categorías activas (HU-016 CA4, HU-037). */
  listCategories(): Promise<Category[]>;
};
