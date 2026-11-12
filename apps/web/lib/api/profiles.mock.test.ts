import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
});

describe('HU-008 API simulada', () => {
  it('conserva el perfil de trabajador, evita duplicados y habilita la publicación', async () => {
    const { mockProfilesApi } = await import('./profiles.mock');
    const { mockSessionApi } = await import('./session.mock');
    await mockProfilesApi.createWorkerProfile({
      displayName: 'Ana',
      photoUrl: '/foto.png',
      skills: ['Cocina'],
      categoryIds: [1],
      zoneId: 1,
    });
    const request = {
      kind: 'COMPANY' as const,
      displayName: 'Empresa',
      photoUrl: '/logo.png',
      description: 'Servicios',
      nit: '800197268',
      nitCheckDigit: '4',
      contactName: 'Privado',
      sector: 'Servicios',
    };
    const result = await mockProfilesApi.createPublisherProfile(request);
    expect(result.ok).toBe(true);
    expect(await mockSessionApi.getCurrentUser()).toMatchObject({
      hasWorkerProfile: true,
      hasPublisherProfile: true,
    });
    expect(await mockProfilesApi.createPublisherProfile(request)).toEqual({
      ok: false,
      reason: 'already_exists',
    });
    if (!result.ok) throw new Error('No se creó el perfil');
    const publicProfile = await mockProfilesApi.getPublicPublisherProfile(result.profile.id);
    expect(Object.keys(publicProfile!).sort()).toEqual(
      ['id', 'kind', 'displayName', 'photoUrl', 'description', 'isVerified'].sort(),
    );
    expect(publicProfile?.isVerified).toBe(false);
    expect(await mockProfilesApi.getPublicPublisherProfile('otro-id')).toBeNull();
  });

  it('lee el estado guardado antes de HU-008', async () => {
    sessionStorage.setItem(
      'red:mock-state',
      JSON.stringify({
        user: { id: 'u1', name: 'Ana', hasPublisherProfile: false },
        workerProfile: null,
      }),
    );
    const { mockSessionApi } = await import('./session.mock');
    expect(await mockSessionApi.getCurrentUser()).toMatchObject({ hasPublisherProfile: false });
  });
});
