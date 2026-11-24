import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewTaskOpportunity } from './opportunities';

const fetchApi = vi.fn<typeof fetch>();
const json = (body: object, status = 200) => Response.json(body, { status });

const input: NewTaskOpportunity = {
  type: 'TASK',
  title: 'Cargar cajas',
  description: 'Necesito ayuda para cargar cajas pesadas en una bodega',
  categoryId: 1,
  zoneId: 2,
  peopleNeeded: 1,
  paymentCop: 70000,
  scheduledAt: '2099-12-01T15:00:00.000Z',
  durationMinutes: 120,
};

const warning = { code: 'FULL_DAY', message: 'Texto jurídico de la advertencia' };

beforeEach(() => {
  vi.resetModules();
  fetchApi.mockReset();
  vi.stubGlobal('fetch', fetchApi);
});
afterEach(() => vi.unstubAllGlobals());

const bodyOf = (call: number) => JSON.parse(String(fetchApi.mock.calls[call][1]?.body));

describe('opportunitiesApi', () => {
  it('devuelve un estado de error recuperable cuando falla el feed', async () => {
    const { opportunitiesApi } = await import('./opportunities.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json({}, 503));
    await expect(opportunitiesApi.list({ mode: 'tasks' })).resolves.toEqual({ status: 'error' });
  });
  it.each([
    ['EMAIL_NOT_CONFIRMED', 'email_not_confirmed', 403],
    ['WORKER_PROFILE_REQUIRED', 'no_worker_profile', 403],
    ['OWN_OPPORTUNITY', 'own_opportunity', 400],
    ['OPPORTUNITY_NOT_AVAILABLE', 'closed', 409],
    ['ALREADY_APPLIED', 'already_applied', 409],
  ] as const)('traduce %s por su código de negocio', async (code, status, httpStatus) => {
    const { opportunitiesApi } = await import('./opportunities.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json({ code }, httpStatus));
    await expect(opportunitiesApi.apply('o')).resolves.toEqual({ status });
  });
  it('lista, consulta detalle y estado de postulación', async () => {
    const { opportunitiesApi } = await import('./opportunities.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json({ items: [], total: 0, page: 1, pageSize: 20 }))
      .mockResolvedValueOnce(json({ id: 'o1' }))
      .mockResolvedValueOnce(json({ o1: true }));
    await opportunitiesApi.list({ mode: 'tasks', page: 1, pageSize: 20 });
    await expect(opportunitiesApi.get('o1')).resolves.toMatchObject({ status: 'found' });
    await expect(opportunitiesApi.applicationStatus(['o1'])).resolves.toEqual({ o1: true });
    expect(String(fetchApi.mock.calls[1][0])).toMatch(/mode=tasks/);
  });

  it('traduce errores esperados al postularse', async () => {
    const { opportunitiesApi } = await import('./opportunities.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json({ code: 'ALREADY_APPLIED' }, 409))
      .mockResolvedValueOnce(json({ code: 'OPPORTUNITY_NOT_AVAILABLE' }, 409))
      .mockResolvedValueOnce(json({ code: 'WORKER_PROFILE_REQUIRED' }, 403))
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json({ errors: { message: ['Muy largo'] } }, 400));
    await expect(opportunitiesApi.apply('o')).resolves.toEqual({ status: 'already_applied' });
    await expect(opportunitiesApi.apply('o')).resolves.toEqual({ status: 'closed' });
    await expect(opportunitiesApi.apply('o')).resolves.toEqual({ status: 'no_worker_profile' });
    await expect(opportunitiesApi.apply('o')).resolves.toEqual({ status: 'not_found' });
    await expect(opportunitiesApi.apply('o')).resolves.toEqual({ status: 'rate_limited' });
    await expect(opportunitiesApi.apply('o')).resolves.toEqual({
      status: 'invalid',
      errors: { message: ['Muy largo'] },
    });
  });
  it('consulta las advertencias con sesión y el mismo cuerpo de la publicación', async () => {
    const { opportunitiesApi } = await import('./opportunities.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json({ warnings: [warning] }));

    await expect(opportunitiesApi.previewLaborWarnings(input)).resolves.toEqual([warning]);

    expect(String(fetchApi.mock.calls[1][0])).toMatch(/\/v1\/opportunities\/labor-warnings$/);
    expect(new Headers(fetchApi.mock.calls[1][1]?.headers).get('authorization')).toBe('Bearer jwt');
    expect(bodyOf(1)).toEqual(input);
  });

  it('publica sin acknowledgeLaborWarning cuando no hubo advertencia', async () => {
    const { opportunitiesApi } = await import('./opportunities.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json({ id: 'op-1' }, 201));

    await expect(opportunitiesApi.publish(input, false)).resolves.toEqual({ ok: true, id: 'op-1' });
    expect(bodyOf(1)).not.toHaveProperty('acknowledgeLaborWarning');
  });

  it('envía acknowledgeLaborWarning: true solo tras confirmar la advertencia', async () => {
    const { opportunitiesApi } = await import('./opportunities.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json({ id: 'op-1' }, 201));

    await opportunitiesApi.publish(input, true);
    expect(bodyOf(1)).toMatchObject({ ...input, acknowledgeLaborWarning: true });
  });

  it('devuelve las advertencias cuando el API responde 409 LABOR_WARNING_REQUIRED', async () => {
    const { opportunitiesApi } = await import('./opportunities.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(
        json(
          { code: 'LABOR_WARNING_REQUIRED', message: 'Lee la advertencia', warnings: [warning] },
          409,
        ),
      );

    await expect(opportunitiesApi.publish(input, false)).resolves.toEqual({
      ok: false,
      reason: 'labor_warning_required',
      warnings: [warning],
    });
  });

  it('no deja pasar advertencias con una forma inesperada', async () => {
    const { opportunitiesApi } = await import('./opportunities.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(
        json({ code: 'LABOR_WARNING_REQUIRED', warnings: [{ code: 1 }, 'texto', warning] }, 409),
      );

    await expect(opportunitiesApi.publish(input, false)).resolves.toMatchObject({
      warnings: [warning],
    });
  });

  it('propaga los demás errores con su estado, cuerpo y espera', async () => {
    const { opportunitiesApi } = await import('./opportunities.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(
        Response.json(
          { message: 'Demasiadas solicitudes' },
          { status: 429, headers: { 'retry-after-ip': '600' } },
        ),
      );

    await expect(opportunitiesApi.publish(input, false)).rejects.toMatchObject({
      status: 429,
      retryAfter: 600,
    });
  });

  it.each([
    [201, { id: 'v1' }, { status: 'published', id: 'v1' }],
    [403, { code: 'PUBLISHER_PROFILE_REQUIRED' }, { status: 'no_publisher_profile' }],
    [403, { code: 'EMAIL_NOT_CONFIRMED' }, { status: 'email_not_confirmed' }],
    [
      400,
      { errors: { closesAt: ['Futura'] } },
      { status: 'invalid', errors: { closesAt: ['Futura'] } },
    ],
  ])('HU-024: publicar vacante formal responde %s como estado', async (status, body, expected) => {
    const { opportunitiesApi } = await import('./opportunities.http');
    fetchApi
      .mockResolvedValueOnce(Response.json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(Response.json(body, { status }));
    const input = {
      title: 'Auxiliar',
      description: 'Descripción suficientemente larga.',
      categoryId: 1,
      zoneId: 2,
      salaryMinCop: 1600000,
      modality: 'ONSITE' as const,
      schedule: 'FULL_TIME' as const,
      experienceRequired: '6 meses',
      requirements: 'Bachiller',
      closesAt: '2099-01-01T00:00:00.000Z',
    };
    await expect(opportunitiesApi.publishFormal(input)).resolves.toEqual(expected);
    expect(JSON.parse(String(fetchApi.mock.calls[1][1]?.body))).toMatchObject({
      type: 'FORMAL_JOB',
    });
  });
});
