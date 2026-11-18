import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchApi = vi.fn<typeof fetch>();
const json = (body: object, status = 200) => Response.json(body, { status });
beforeEach(() => {
  vi.resetModules();
  fetchApi.mockReset();
  vi.stubGlobal('fetch', fetchApi);
});
afterEach(() => vi.unstubAllGlobals());

describe('Integración de HU-008', () => {
  it('restaura una única sesión ante lecturas simultáneas y distingue 401 de un fallo del servidor', async () => {
    const { sessionApi } = await import('./session.http');
    const user = {
      id: 'u1',
      name: 'Ana',
      hasWorkerProfile: true,
      hasPublisherProfile: true,
      publisherProfileId: 'p1',
    };
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json(user))
      .mockResolvedValueOnce(json(user));
    await expect(
      Promise.all([sessionApi.getCurrentUser(), sessionApi.getCurrentUser()]),
    ).resolves.toEqual([user, user]);
    expect(fetchApi.mock.calls.filter(([path]) => String(path).endsWith('/refresh'))).toHaveLength(
      1,
    );
    expect(new Headers(fetchApi.mock.calls[1][1]?.headers).get('authorization')).toBe('Bearer jwt');
    fetchApi.mockResolvedValueOnce(json({}, 503));
    await expect(sessionApi.getCurrentUser()).rejects.toMatchObject({ status: 503 });
    fetchApi.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({}, 401));
    await expect(sessionApi.getCurrentUser()).resolves.toBeNull();
  });
  it('envía el logo y el NIT completo y distingue el NIT duplicado del perfil existente', async () => {
    const { profilesApi } = await import('./profiles.http');
    const company = {
      kind: 'COMPANY' as const,
      displayName: 'Empresa',
      description: 'Servicios',
      nit: '800197268',
      nitCheckDigit: '4',
      sector: 'Transporte',
      contactName: 'Ana',
      photo: new File(['imagen'], 'logo.png', { type: 'image/png' }),
    };
    fetchApi
      .mockResolvedValueOnce(json({ accessToken: 'jwt' }))
      .mockResolvedValueOnce(json({ code: 'NIT_TAKEN' }, 409))
      .mockResolvedValueOnce(json({ code: 'PUBLISHER_EXISTS' }, 409))
      .mockResolvedValueOnce(json({ id: 'p1' }));
    await expect(profilesApi.createPublisherProfile(company)).resolves.toEqual({
      ok: false,
      reason: 'nit_taken',
    });
    const form = fetchApi.mock.calls[1][1]?.body as FormData;
    expect(form.get('nit')).toBe('800197268-4');
    expect(form.has('nitCheckDigit')).toBe(false);
    expect(form.get('photo')).toEqual(company.photo);
    await expect(profilesApi.createPublisherProfile(company)).resolves.toEqual({
      ok: false,
      reason: 'already_exists',
      id: 'p1',
    });
  });
  it('consulta el perfil público sin sesión y distingue un perfil ausente de un fallo del servidor', async () => {
    const { profilesApi } = await import('./profiles.http');
    fetchApi.mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json({}, 503));
    await expect(
      profilesApi.getPublicPublisherProfile('8fcbfa5e-054b-4c79-a2e4-fabf6fed4703'),
    ).resolves.toBeNull();
    expect(fetchApi.mock.calls[0][1]?.credentials).toBe('omit');
    await expect(
      profilesApi.getPublicPublisherProfile('8fcbfa5e-054b-4c79-a2e4-fabf6fed4703'),
    ).rejects.toMatchObject({
      status: 503,
    });
  });
});
