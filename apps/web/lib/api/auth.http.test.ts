import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchApi = vi.fn<typeof fetch>();
const json = (body: object, status = 200, headers?: HeadersInit) =>
  Response.json(body, { status, headers });

beforeEach(() => {
  vi.resetModules();
  fetchApi.mockReset();
  vi.stubGlobal('fetch', fetchApi);
});
afterEach(() => vi.unstubAllGlobals());

describe('Recuperación de contraseña (HU-018)', () => {
  it('pide el enlace sin cookies y traduce el 429 a minutos de espera', async () => {
    const { authApi } = await import('./auth.http');
    fetchApi
      .mockResolvedValueOnce(json({ message: 'ok' }, 202))
      .mockResolvedValueOnce(json({ message: 'Demasiados' }, 429, { 'Retry-After-ip': '90' }))
      .mockResolvedValueOnce(json({ message: 'Demasiados' }, 429));

    await expect(authApi.forgotPassword('ana@example.com')).resolves.toEqual({ status: 'sent' });
    const [url, init] = fetchApi.mock.calls[0];
    expect(String(url)).toMatch(/\/v1\/auth\/forgot-password$/);
    expect(init?.credentials).toBe('omit');
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'ana@example.com' });

    await expect(authApi.forgotPassword('ana@example.com')).resolves.toEqual({
      status: 'rate_limited',
      retryAfterMinutes: 2,
    });
    // Sin la cabecera (límite por correo) se usa la ventana de 15 minutos.
    await expect(authApi.forgotPassword('ana@example.com')).resolves.toEqual({
      status: 'rate_limited',
      retryAfterMinutes: 15,
    });
  });

  it('distingue éxito, enlace vencido, errores por campo y fallos del servidor', async () => {
    const { authApi } = await import('./auth.http');
    const values = { token: 't', password: 'Nueva1234', passwordConfirmation: 'Nueva1234' };
    fetchApi
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ code: 'RESET_LINK_EXPIRED' }, 410))
      .mockResolvedValueOnce(json({ message: 'Revisa', errors: { password: ['Muy débil'] } }, 400))
      .mockResolvedValueOnce(json({}, 503));

    await expect(authApi.resetPassword(values)).resolves.toEqual({ status: 'ok' });
    await expect(authApi.resetPassword(values)).resolves.toEqual({ status: 'expired' });
    await expect(authApi.resetPassword(values)).resolves.toEqual({
      status: 'invalid',
      errors: { password: ['Muy débil'] },
    });
    await expect(authApi.resetPassword(values)).rejects.toMatchObject({ status: 503 });
  });
});
