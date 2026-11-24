import { afterEach, expect, it, vi } from 'vitest';
import { activityApi } from './activity.http';
afterEach(() => vi.unstubAllGlobals());
it('usa sesión y respeta rutas, filtros, verbos y cuerpos del contrato de Mi actividad', async () => {
  const fetchApi = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ accessToken: 'sesion' }))
    .mockImplementation(async () => Response.json({}));
  vi.stubGlobal('fetch', fetchApi);
  const calls: [() => Promise<unknown>, string, string, object?][] = [
    [() => activityApi.applications('all', 2), '/applications/mine?state=all&page=2', 'GET'],
    [() => activityApi.publications(3), '/opportunities/mine?page=3', 'GET'],
    [() => activityApi.own('p'), '/opportunities/mine/p', 'GET'],
    [() => activityApi.details('p'), '/opportunities/p', 'GET'],
    [
      () => activityApi.update('p', { paymentCop: 50000 }),
      '/opportunities/p',
      'PATCH',
      { paymentCop: 50000 },
    ],
    [() => activityApi.address('p', ''), '/opportunities/p/address', 'PUT', { address: '' }],
    [() => activityApi.resume('p'), '/opportunities/p/resume', 'POST'],
    [
      () => activityApi.changeStatus('p', 'pause', 'Por lluvia'),
      '/opportunities/p/pause',
      'POST',
      { reason: 'Por lluvia' },
    ],
    [() => activityApi.applicants('p'), '/opportunities/p/applicants', 'GET'],
    [
      () => activityApi.select('p', ['a']),
      '/opportunities/p/selections',
      'POST',
      { applicationIds: ['a'] },
    ],
    [() => activityApi.candidates('p'), '/opportunities/p/candidates', 'GET'],
    [
      () => activityApi.changeCandidate('a', 'INTERVIEW'),
      '/applications/a/status',
      'PATCH',
      { status: 'INTERVIEW' },
    ],
    [() => activityApi.selections(), '/selections/mine', 'GET'],
    [() => activityApi.accept('s'), '/selections/s/accept', 'POST', { acceptTerms: true }],
    [() => activityApi.reject('s'), '/selections/s/reject', 'POST'],
    [
      () => activityApi.jobs('publisher', 'finished', 2),
      '/jobs?role=publisher&state=finished&page=2',
      'GET',
    ],
    [() => activityApi.job('j'), '/jobs/j', 'GET'],
    [() => activityApi.finish('j', 'finish'), '/jobs/j/finish', 'POST'],
    [() => activityApi.finish('j', 'confirm-finish'), '/jobs/j/confirm-finish', 'POST'],
    [
      () => activityApi.cancelJob('j', 'Por lluvia'),
      '/jobs/j/cancel',
      'POST',
      { reason: 'Por lluvia' },
    ],
  ];
  for (const [call, path, method, body] of calls) {
    await call();
    const [url, init] = fetchApi.mock.lastCall!;
    expect(String(url)).toMatch('/v1' + path);
    expect(init?.method ?? 'GET').toBe(method);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer sesion');
    expect(init?.body).toBe(JSON.stringify(body));
  }
  fetchApi.mockResolvedValueOnce(
    Response.json({ code: 'SELECTION_LIMIT_REACHED' }, { status: 409 }),
  );
  await expect(activityApi.select('p', ['a'])).rejects.toMatchObject({
    status: 409,
    problem: { code: 'SELECTION_LIMIT_REACHED' },
  });
});
