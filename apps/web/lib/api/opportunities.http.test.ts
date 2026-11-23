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
});
