import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchApi = vi.fn<typeof fetch>();
const json = (body: object, status = 200) => Response.json(body, { status });
const ID = '8fcbfa5e-054b-4c79-a2e4-fabf6fed4703';

beforeEach(() => {
  vi.resetModules();
  fetchApi.mockReset();
  vi.stubGlobal('fetch', fetchApi);
});
afterEach(() => vi.unstubAllGlobals());

describe('Perfil público del trabajador (HU-029)', () => {
  it('se pide sin cookies, vuelve absoluta la foto y respeta la foto oculta', async () => {
    const { profilesApi } = await import('./profiles.http');
    fetchApi
      .mockResolvedValueOnce(json({ id: ID, photoUrl: `/v1/profiles/worker/${ID}/photo` }))
      .mockResolvedValueOnce(json({ id: ID, photoUrl: null }));

    const visible = await profilesApi.getPublicWorkerProfile(ID);
    expect(String(fetchApi.mock.calls[0][0])).toMatch(new RegExp(`/v1/profiles/worker/${ID}$`));
    expect(fetchApi.mock.calls[0][1]?.credentials).toBe('omit');
    expect(visible?.photoUrl).toMatch(/^https?:\/\/.+\/v1\/profiles\/worker\/.+\/photo$/);

    expect((await profilesApi.getPublicWorkerProfile(ID))?.photoUrl).toBeNull();
  });

  it('un id inválido o un 404 dan null; otro error se propaga', async () => {
    const { profilesApi } = await import('./profiles.http');
    await expect(profilesApi.getPublicWorkerProfile('no-es-uuid')).resolves.toBeNull();
    expect(fetchApi).not.toHaveBeenCalled();

    fetchApi.mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json({}, 500));
    await expect(profilesApi.getPublicWorkerProfile(ID)).resolves.toBeNull();
    await expect(profilesApi.getPublicWorkerProfile(ID)).rejects.toMatchObject({ status: 500 });
  });
});
