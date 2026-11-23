import { describe, expect, it } from 'vitest';
import { durationInMinutes, parseCop, taskFormSchema, type TaskFormValues } from './task-schema';

const valid: TaskFormValues = {
  title: 'Cargar cajas',
  description: 'Necesito ayuda para cargar cajas pesadas en una bodega',
  categoryId: '1',
  zoneId: '2',
  peopleNeeded: '3',
  payment: '70.000',
  scheduledAt: '2099-12-01T10:00',
  durationValue: '2',
  durationUnit: 'hours',
  conditions: '',
};

function issues(overrides: Partial<TaskFormValues>) {
  const result = taskFormSchema.safeParse({ ...valid, ...overrides });
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

describe('parseCop', () => {
  it.each([
    ['70000', 70000],
    ['70.000', 70000],
    ['$ 70.000', 70000],
    ['1.500.000', 1500000],
  ])('%s -> %i', (text, expected) => {
    expect(parseCop(text)).toBe(expected);
  });

  it.each(['', 'abc', '70,5', '-100'])('rechaza "%s"', (text) => {
    expect(parseCop(text)).toBeNull();
  });
});

describe('durationInMinutes', () => {
  it('convierte según la unidad', () => {
    expect(durationInMinutes('45', 'minutes')).toBe(45);
    expect(durationInMinutes('2', 'hours')).toBe(120);
    expect(durationInMinutes('3', 'days')).toBe(4320);
  });

  it('admite decimales con punto o coma', () => {
    expect(durationInMinutes('1,5', 'hours')).toBe(90);
    expect(durationInMinutes('1.5', 'hours')).toBe(90);
  });

  it('rechaza lo que no es un número', () => {
    expect(durationInMinutes('dos', 'hours')).toBeNull();
    expect(durationInMinutes('-1', 'hours')).toBeNull();
  });
});

describe('taskFormSchema', () => {
  it('convierte el formulario al cuerpo que espera el API', () => {
    const result = taskFormSchema.parse(valid);
    expect(result).toEqual({
      title: 'Cargar cajas',
      description: 'Necesito ayuda para cargar cajas pesadas en una bodega',
      categoryId: 1,
      zoneId: 2,
      peopleNeeded: 3,
      paymentCop: 70000,
      scheduledAt: '2099-12-01T15:00:00.000Z',
      durationMinutes: 120,
    });
    expect(result).not.toHaveProperty('conditions');
  });

  it('incluye las condiciones solo si se escribieron', () => {
    expect(taskFormSchema.parse({ ...valid, conditions: '  Llevar guantes ' })).toMatchObject({
      conditions: 'Llevar guantes',
    });
  });

  it('marca cada campo obligatorio vacío (HU-003 CA3)', () => {
    const result = issues({
      title: '',
      description: '',
      categoryId: '',
      zoneId: '',
      peopleNeeded: '',
      payment: '',
      scheduledAt: '',
      durationValue: '',
    });
    expect(Object.keys(result).sort()).toEqual(
      [
        'categoryId',
        'description',
        'durationValue',
        'payment',
        'peopleNeeded',
        'scheduledAt',
        'title',
        'zoneId',
      ].sort(),
    );
  });

  it('respeta los límites de longitud del API', () => {
    expect(issues({ title: 'Hola' }).title).toMatch(/al menos 5/);
    expect(issues({ title: 'x'.repeat(121) }).title).toMatch(/máximo 120/);
    expect(issues({ description: 'corta' }).description).toMatch(/al menos 20/);
    expect(issues({ conditions: 'x'.repeat(1001) }).conditions).toMatch(/máximo 1000/);
  });

  it('exige de 1 a 50 personas', () => {
    expect(issues({ peopleNeeded: '0' }).peopleNeeded).toBeDefined();
    expect(issues({ peopleNeeded: '51' }).peopleNeeded).toBeDefined();
    expect(issues({ peopleNeeded: '2,5' }).peopleNeeded).toBeDefined();
    expect(issues({ peopleNeeded: '50' }).peopleNeeded).toBeUndefined();
  });

  it('exige un pago entero mayor que cero y razonable', () => {
    expect(issues({ payment: '0' }).payment).toBeDefined();
    expect(issues({ payment: '70,50' }).payment).toBeDefined();
    expect(issues({ payment: '100.000.001' }).payment).toBeDefined();
  });

  it('rechaza fechas pasadas', () => {
    expect(issues({ scheduledAt: '2020-01-01T10:00' }).scheduledAt).toMatch(/posterior/);
  });

  it('exige al menos 15 minutos y como máximo un año de duración', () => {
    expect(issues({ durationValue: '10', durationUnit: 'minutes' }).durationValue).toMatch(
      /15 minutos/,
    );
    expect(issues({ durationValue: '400', durationUnit: 'days' }).durationValue).toMatch(/un año/);
    expect(issues({ durationValue: '15', durationUnit: 'minutes' }).durationValue).toBeUndefined();
  });
});
