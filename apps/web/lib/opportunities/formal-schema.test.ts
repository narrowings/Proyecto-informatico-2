import { describe, expect, it } from 'vitest';
import { emptyFormal, validateFormal, type FormalFormValues } from './formal-schema';

const NOW = new Date('2026-11-24T12:00:00Z');
const valid: FormalFormValues = {
  ...emptyFormal,
  title: 'Auxiliar de bodega',
  description: 'Recepción y despacho de mercancía.',
  categoryId: '1',
  zoneId: '2',
  salaryMin: '1.600.000',
  salaryMax: '2.000.000',
  modality: 'HYBRID',
  schedule: 'PART_TIME',
  experienceRequired: '6 meses',
  requirements: 'Bachiller',
  closesAt: '2026-12-01T17:00',
};

describe('HU-024 Validación de la vacante formal', () => {
  it('arma la vacante con montos en pesos y el cierre en UTC', () => {
    const result = validateFormal(valid, NOW);
    expect(result).toEqual({
      ok: true,
      input: expect.objectContaining({
        salaryMinCop: 1600000,
        salaryMaxCop: 2000000,
        closesAt: '2026-12-01T22:00:00.000Z',
      }),
    });
  });

  it('el salario máximo es opcional, pero no menor que el mínimo', () => {
    const fixed = validateFormal({ ...valid, salaryMax: '' }, NOW);
    expect(fixed.ok && fixed.input).not.toHaveProperty('salaryMaxCop');
    const wrong = validateFormal({ ...valid, salaryMax: '1.000.000' }, NOW);
    expect(wrong).toMatchObject({
      ok: false,
      errors: { salaryMax: expect.stringMatching(/menor/) },
    });
  });

  it('exige todos los campos obligatorios y una fecha de cierre futura', () => {
    const empty = validateFormal(emptyFormal, NOW);
    expect(empty.ok).toBe(false);
    expect(Object.keys(!empty.ok ? empty.errors : {})).toEqual(
      expect.arrayContaining([
        'title',
        'description',
        'categoryId',
        'zoneId',
        'salaryMin',
        'modality',
        'schedule',
        'experienceRequired',
        'requirements',
        'closesAt',
      ]),
    );
    expect(validateFormal({ ...valid, closesAt: '2026-11-24T06:00' }, NOW)).toMatchObject({
      ok: false,
      errors: { closesAt: 'La fecha de cierre debe ser futura.' },
    });
  });
});
