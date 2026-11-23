import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchApi = vi.fn<typeof fetch>();
const json = (body: object, status = 200) => Response.json(body, { status });

beforeEach(() => {
  vi.resetModules();
  fetchApi.mockReset();
  vi.stubGlobal('fetch', fetchApi);
});
afterEach(() => vi.unstubAllGlobals());

const lastCall = () => fetchApi.mock.calls.at(-1)!;

describe('Mi perfil de trabajador (HU-032, HU-030)', () => {
  it('lee el perfil propio con sesión; sin perfil devuelve null', async () => {
    const { profilesApi } = await import('./profiles.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json({ id: 'w1', showPhoto: false }))
      .mockResolvedValueOnce(json({ message: 'Aún no tienes perfil' }, 404));

    await expect(profilesApi.getOwnWorkerProfile()).resolves.toMatchObject({ id: 'w1' });
    expect(new Headers(lastCall()[1]?.headers).get('authorization')).toBe('Bearer jwt');
    await expect(profilesApi.getOwnWorkerProfile()).resolves.toBeNull();
  });

  it('envía solo los cambios en JSON y devuelve los errores por campo', async () => {
    const { profilesApi } = await import('./profiles.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json({ id: 'w1', availability: 'UNAVAILABLE' }))
      .mockResolvedValueOnce(
        json({ message: 'Revisa', errors: { zoneId: ['Elige una zona'] } }, 400),
      );

    await expect(
      profilesApi.updateWorkerProfile({ availability: 'UNAVAILABLE' }),
    ).resolves.toMatchObject({ ok: true, profile: { availability: 'UNAVAILABLE' } });
    const [url, init] = lastCall();
    expect(String(url)).toMatch(/\/v1\/profiles\/worker\/me$/);
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ availability: 'UNAVAILABLE' });

    await expect(profilesApi.updateWorkerProfile({ zoneId: 99 })).resolves.toEqual({
      ok: false,
      errors: { zoneId: ['Elige una zona'] },
    });
  });

  it('cambia la foto por multipart y reconoce el archivo demasiado grande', async () => {
    const { profilesApi } = await import('./profiles.http');
    const photo = new File(['img'], 'foto.png', { type: 'image/png' });
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json({ id: 'w1' }))
      .mockResolvedValueOnce(new Response(null, { status: 413 }));

    await expect(profilesApi.replaceWorkerPhoto(photo)).resolves.toMatchObject({ ok: true });
    expect(lastCall()[1]?.method).toBe('PUT');
    expect((lastCall()[1]?.body as FormData).get('photo')).toEqual(photo);
    await expect(profilesApi.replaceWorkerPhoto(photo)).resolves.toEqual({
      ok: false,
      reason: 'too_large',
    });
  });

  it('descarga la foto propia como archivo con el token', async () => {
    const { profilesApi } = await import('./profiles.http');
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(new Response('png', { headers: { 'Content-Type': 'image/png' } }));

    const blob = await profilesApi.getOwnWorkerPhoto();
    expect(blob.type).toBe('image/png');
    expect(String(lastCall()[0])).toMatch(/\/v1\/profiles\/worker\/me\/photo$/);
    expect(new Headers(lastCall()[1]?.headers).get('authorization')).toBe('Bearer jwt');
  });
});
