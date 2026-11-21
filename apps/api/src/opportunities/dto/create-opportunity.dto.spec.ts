import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validationPipe } from '../../common/validation';
import { CreateOpportunityDto } from './create-opportunity.dto';
import { ListOpportunitiesQuery } from './list-opportunities.query';

const task = (overrides: object = {}) => ({
  type: 'TASK',
  title: 'Pintar sala comedor',
  description: 'Pintar una sala comedor de 20 metros cuadrados con pintura incluida.',
  categoryId: 3,
  zoneId: 2,
  peopleNeeded: 2,
  paymentCop: 150000,
  scheduledAt: '2026-12-01T15:00:00Z',
  durationMinutes: 240,
  ...overrides,
});

const formal = (overrides: object = {}) => ({
  type: 'FORMAL_JOB',
  title: 'Auxiliar de bodega',
  description: 'Cargue y descargue de mercancía en bodega del norte de Cali.',
  categoryId: 1,
  zoneId: 1,
  salaryMinCop: 1500000,
  salaryMaxCop: 1800000,
  modality: 'ONSITE',
  schedule: 'FULL_TIME',
  experienceRequired: '6 meses',
  requirements: 'Bachiller',
  closesAt: '2026-12-20T23:00:00Z',
  ...overrides,
});

const validate = (body: object, metatype: new () => object = CreateOpportunityDto) =>
  validationPipe.transform(body, { type: 'body', metatype });

const errorsOf = async (body: object, metatype?: new () => object) => {
  try {
    await validate(body, metatype);
  } catch (error) {
    return ((error as BadRequestException).getResponse() as { errors: Record<string, string[]> })
      .errors;
  }
  throw new Error('Se esperaba un error de validación');
};

describe('CreateOpportunityDto (HU-025, HU-003, HU-024)', () => {
  it('acepta una tarea completa y una vacante formal completa', async () => {
    await expect(validate(task())).resolves.toMatchObject({ type: 'TASK', paymentCop: 150000 });
    await expect(validate(formal())).resolves.toMatchObject({ type: 'FORMAL_JOB' });
  });

  it('la vacante formal no exige los campos de tarea, ni la tarea los de vacante', async () => {
    await expect(validate(formal({ peopleNeeded: undefined }))).resolves.toBeDefined();
    await expect(validate(task({ modality: undefined }))).resolves.toBeDefined();
  });

  it('el salario máximo es opcional (salario fijo)', async () => {
    const body: Record<string, unknown> = formal();
    delete body.salaryMaxCop;
    await expect(validate(body)).resolves.toBeDefined();
  });

  it.each([
    ['tipo desconocido', { type: 'EMPLEO' }, 'type', 'Elige el tipo de oportunidad'],
    [
      'pago cero (RN-19)',
      { paymentCop: 0 },
      'paymentCop',
      'Indica el pago ofrecido en pesos, mayor que cero',
    ],
    [
      'pago negativo',
      { paymentCop: -1 },
      'paymentCop',
      'Indica el pago ofrecido en pesos, mayor que cero',
    ],
    [
      'pago con decimales',
      { paymentCop: 1000.5 },
      'paymentCop',
      'Indica el pago ofrecido en pesos, mayor que cero',
    ],
    ['pago desmesurado', { paymentCop: 100_000_001 }, 'paymentCop', 'El valor es demasiado alto'],
    ['cero personas', { peopleNeeded: 0 }, 'peopleNeeded', 'Indica cuántas personas necesitas'],
    ['51 personas', { peopleNeeded: 51 }, 'peopleNeeded', 'Máximo 50 personas por publicación'],
    [
      'sin fecha',
      { scheduledAt: undefined },
      'scheduledAt',
      'Indica la fecha y hora de realización',
    ],
    [
      'fecha no ISO',
      { scheduledAt: '01/12/2026' },
      'scheduledAt',
      'Indica la fecha y hora de realización',
    ],
    [
      'duración de 14 min',
      { durationMinutes: 14 },
      'durationMinutes',
      'La duración mínima es de 15 minutos',
    ],
    ['título corto', { title: 'Pin' }, 'title', 'El título debe tener al menos 5 caracteres'],
    [
      'título de 121',
      { title: 'a'.repeat(121) },
      'title',
      'El título admite máximo 120 caracteres',
    ],
    [
      'descripción corta',
      { description: 'Pintar' },
      'description',
      'Describe la oportunidad con al menos 20 caracteres',
    ],
    ['sin zona', { zoneId: undefined }, 'zoneId', 'Elige la zona de Cali'],
  ])('tarea: rechaza %s', async (_case, overrides, field, message) => {
    expect((await errorsOf(task(overrides)))[field]).toEqual([message]);
  });

  it.each([
    [
      'sin salario',
      { salaryMinCop: undefined },
      'salaryMinCop',
      'Indica el salario en pesos, mayor que cero',
    ],
    ['modalidad inválida', { modality: 'PRESENCIAL' }, 'modality', 'Elige la modalidad'],
    ['sin jornada', { schedule: undefined }, 'schedule', 'Elige la jornada'],
    [
      'sin experiencia',
      { experienceRequired: '  ' },
      'experienceRequired',
      'Indica la experiencia requerida',
    ],
    ['sin requisitos', { requirements: undefined }, 'requirements', 'Indica los requisitos'],
    [
      'sin fecha de cierre',
      { closesAt: undefined },
      'closesAt',
      'Indica la fecha de cierre de la vacante',
    ],
  ])('vacante formal: rechaza %s', async (_case, overrides, field, message) => {
    expect((await errorsOf(formal(overrides)))[field]).toEqual([message]);
  });

  it('no se puede enviar la dirección exacta ni el dueño al publicar (RF-03-04)', async () => {
    const errors = await errorsOf(task({ exactAddress: 'Cra 1 # 2-3', publisherProfileId: 'x' }));
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(['exactAddress', 'publisherProfileId']),
    );
  });
});

describe('ListOpportunitiesQuery (HU-010)', () => {
  it('convierte los números de la URL', async () => {
    await expect(
      validate(
        { mode: 'tasks', zoneId: '2', paymentMin: '50000', page: '2' },
        ListOpportunitiesQuery,
      ),
    ).resolves.toMatchObject({ zoneId: 2, paymentMin: 50000, page: 2 });
  });

  it('exige el modo y limita la página a 50 resultados', async () => {
    const errors = await errorsOf({ pageSize: '51' }, ListOpportunitiesQuery);
    expect(errors.mode).toEqual(['El modo debe ser formal o tasks']);
    expect(errors.pageSize).toEqual(['Máximo 50 resultados por página']);
  });

  it('rechaza una búsqueda de más de 100 caracteres', async () => {
    const errors = await errorsOf({ mode: 'tasks', q: 'a'.repeat(101) }, ListOpportunitiesQuery);
    expect(errors.q).toEqual(['La búsqueda admite máximo 100 caracteres']);
  });
});
