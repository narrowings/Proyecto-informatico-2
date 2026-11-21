// RF-04-08: la búsqueda tolera tildes y mayúsculas. Se guarda el texto ya normalizado en
// `search_text` y la palabra clave se normaliza igual antes de comparar.
export const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const buildSearchText = (parts: Array<string | null | undefined>) =>
  normalizeSearch(parts.filter(Boolean).join(' '));
