import { describe, expect, it } from 'vitest';
import { evaluateLaborWarnings, type LaborWarningRuleRow } from './labor-warnings';
import { buildSearchText, normalizeSearch } from './search-text';

const rules: LaborWarningRuleRow[] = [
  { code: 'FULL_DAY', message: 'jornada', params: { minMinutes: 480 } },
  { code: 'LONG_TERM', message: 'continuidad', params: { minMinutes: 43200 } },
  {
    code: 'SUBORDINATION_TERMS',
    message: 'subordinación',
    params: { terms: ['horario fijo', 'todos los dias'] },
  },
];
const codes = (input: Parameters<typeof evaluateLaborWarnings>[0], list = rules) =>
  evaluateLaborWarnings(input, list).map((warning) => warning.code);

describe('Advertencia de relación laboral (HU-003 CA2, RF-03-05)', () => {
  it('jornada: 479 minutos no advierte y 480 sí (límite exacto)', () => {
    expect(codes({ type: 'TASK', durationMinutes: 479 })).toEqual([]);
    expect(codes({ type: 'TASK', durationMinutes: 480 })).toEqual(['FULL_DAY']);
  });

  it('continuidad solo aplica a proyectos y servicios de un mes o más', () => {
    expect(codes({ type: 'PROJECT', durationMinutes: 43200 })).toEqual(['FULL_DAY', 'LONG_TERM']);
    expect(codes({ type: 'SERVICE', durationMinutes: 43199 })).toEqual(['FULL_DAY']);
    expect(codes({ type: 'QUICK_JOB', durationMinutes: 43200 })).toEqual(['FULL_DAY']);
  });

  it('detecta términos de subordinación sin importar tildes ni mayúsculas', () => {
    expect(codes({ type: 'TASK', description: 'Se trabaja TODOS LOS DÍAS en la tienda' })).toEqual([
      'SUBORDINATION_TERMS',
    ]);
    expect(codes({ type: 'TASK', conditions: 'Con Horario Fijo de 8 a 5' })).toEqual([
      'SUBORDINATION_TERMS',
    ]);
    expect(codes({ type: 'TASK', description: 'Arreglar una puerta el sábado' })).toEqual([]);
  });

  it('la vacante formal ya es empleo: nunca lleva la advertencia', () => {
    expect(
      codes({ type: 'FORMAL_JOB', durationMinutes: 99999, description: 'horario fijo' }),
    ).toEqual([]);
  });

  it('los umbrales vienen de la base: el administrador puede ajustarlos', () => {
    const strict = [{ code: 'FULL_DAY', message: 'x', params: { minMinutes: 240 } }];
    expect(codes({ type: 'TASK', durationMinutes: 240 }, strict)).toEqual(['FULL_DAY']);
  });

  it('parámetros ausentes o inválidos usan el valor por defecto y una regla desconocida se ignora', () => {
    const odd = [
      { code: 'FULL_DAY', message: 'x', params: { minMinutes: 'mucho' } },
      { code: 'NO_EXISTE', message: 'y', params: {} },
      { code: 'SUBORDINATION_TERMS', message: 'z', params: null },
    ];
    expect(codes({ type: 'TASK', durationMinutes: 480, description: 'horario fijo' }, odd)).toEqual(
      ['FULL_DAY'],
    );
  });

  it('devuelve el texto aprobado de cada regla', () => {
    expect(evaluateLaborWarnings({ type: 'TASK', durationMinutes: 600 }, rules)).toEqual([
      { code: 'FULL_DAY', message: 'jornada' },
    ]);
  });
});

describe('Texto de búsqueda (RF-04-08)', () => {
  it('quita tildes, pasa a minúsculas y compacta espacios', () => {
    expect(normalizeSearch('  Edición   de VIDEO y Fotografía ')).toBe(
      'edicion de video y fotografia',
    );
    expect(normalizeSearch('Pequeño ÑANDÚ')).toBe('pequeno nandu');
  });

  it('une título, descripción y categoría ignorando vacíos', () => {
    expect(buildSearchText(['Pintar Sala', null, 'Reparaciones del hogar', undefined])).toBe(
      'pintar sala reparaciones del hogar',
    );
  });
});
