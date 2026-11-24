import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchApi = vi.fn<typeof fetch>();
const json = (body: object, status = 200) => Response.json(body, { status });
const JOB = '8fcbfa5e-054b-4c79-a2e4-fabf6fed4703';
const scores = { fulfillment: 5, punctuality: 4, communication: 5, quality: 3 };

beforeEach(() => {
  vi.resetModules();
  fetchApi.mockReset();
  vi.stubGlobal('fetch', fetchApi);
});
afterEach(() => vi.unstubAllGlobals());

describe('Calificaciones (HU-007, HU-046)', () => {
  it('califica con sesión e indica si quedó publicada', async () => {
    const { ratingsApi } = await import('./ratings.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json({ id: 'r1', publishedAt: null }))
      .mockResolvedValueOnce(json({ id: 'r2', publishedAt: '2026-11-23T15:00:00.000Z' }));

    await expect(ratingsApi.rateJob(JOB, scores)).resolves.toEqual({
      status: 'rated',
      published: false,
    });
    const [url, init] = fetchApi.mock.calls[1];
    expect(String(url)).toMatch(new RegExp(`/v1/jobs/${JOB}/ratings$`));
    expect(JSON.parse(String(init?.body))).toEqual(scores);
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer jwt');

    await expect(ratingsApi.rateJob(JOB, scores)).resolves.toEqual({
      status: 'rated',
      published: true,
    });
  });

  it('traduce los errores de negocio', async () => {
    const { ratingsApi } = await import('./ratings.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json({ code: 'ALREADY_RATED' }, 409))
      .mockResolvedValueOnce(json({ code: 'JOB_NOT_COMPLETED' }, 409))
      .mockResolvedValueOnce(json({ code: 'JOB_NOT_FOUND' }, 404))
      .mockResolvedValueOnce(json({ message: 'Revisa', errors: { quality: ['Máximo 5'] } }, 400));

    await expect(ratingsApi.rateJob(JOB, scores)).resolves.toEqual({ status: 'already_rated' });
    await expect(ratingsApi.rateJob(JOB, scores)).resolves.toEqual({ status: 'not_completed' });
    await expect(ratingsApi.rateJob(JOB, scores)).resolves.toEqual({ status: 'not_found' });
    await expect(ratingsApi.rateJob(JOB, scores)).resolves.toEqual({
      status: 'invalid',
      errors: { quality: ['Máximo 5'] },
    });
    await expect(ratingsApi.rateJob('no-es-uuid', scores)).resolves.toEqual({
      status: 'not_found',
    });
  });

  it('pide mi reputación paginada', async () => {
    const { ratingsApi } = await import('./ratings.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json({ worker: {}, publisher: {}, ratings: { items: [], total: 0 } }));

    await ratingsApi.getMyRatings(2);
    expect(String(fetchApi.mock.calls[1][0])).toMatch(/\/v1\/ratings\/mine\?page=2&pageSize=10$/);
  });
});
