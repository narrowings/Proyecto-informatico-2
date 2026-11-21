import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { SessionService } from '../session/session.service';
import { PASSWORD_RESET_TTL_MS, PasswordResetService } from './password-reset.service';
import { hashToken } from './tokens';

function preparar() {
  const tokenRecibido = 'enlace';
  const usuario = { id: 'u', email: 'ana@example.com', name: 'Ana', status: 'ACTIVE' };
  const registro = {
    id: 'r',
    userId: 'u',
    usedAt: null,
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  };
  const tx = {
    user: { findUnique: vi.fn().mockResolvedValue(usuario), update: vi.fn() },
    passwordResetToken: {
      findUnique: vi.fn().mockResolvedValue(registro),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn(),
    },
  };
  const correo = { send: vi.fn() };
  const sesiones = { revokeAllForUser: vi.fn() };
  const servicio = new PasswordResetService(
    {
      ...tx,
      $transaction: (operar: (cliente: typeof tx) => unknown) => operar(tx),
    } as unknown as PrismaService,
    correo,
    new ConfigService({ WEB_URL: 'https://example.com/' }),
    sesiones as unknown as SessionService,
  );
  const dto = { token: tokenRecibido, password: 'Nueva1234', passwordConfirmation: 'Nueva1234' };
  return { servicio, tx, correo, sesiones, registro, dto };
}

describe('HU-018 Recuperación de contraseña', () => {
  it('invalida enlaces anteriores y guarda solo el hash del enlace entregado', async () => {
    const { servicio, tx, correo } = preparar();
    await servicio.enviarEnlace('ana@example.com');
    const enlace = new URL(correo.send.mock.calls[0][0].link);
    const token = enlace.searchParams.get('token')!;
    expect(enlace.pathname).toBe('/restablecer-contrasena');
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u', usedAt: null } }),
    );
    expect(tx.passwordResetToken.create).toHaveBeenCalledWith({
      data: {
        userId: 'u',
        tokenHash: hashToken(token),
        expiresAt: expect.any(Date),
      },
    });
  });

  it('un correo inexistente o suspendido no recibe un enlace', async () => {
    const { servicio, tx, correo } = preparar();
    tx.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ status: 'SUSPENDED' });
    await servicio.enviarEnlace('nadie@example.com');
    await servicio.enviarEnlace('suspendida@example.com');
    expect(correo.send).not.toHaveBeenCalled();
    expect(tx.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('el enlace vence a los 30 minutos exactos', async () => {
    const { servicio, tx, registro, dto } = preparar();
    const ahora = new Date('2026-11-20T12:30:00Z');
    vi.setSystemTime(ahora);
    registro.expiresAt = new Date(ahora.getTime() - PASSWORD_RESET_TTL_MS + 30 * 60_000);
    try {
      await expect(servicio.restablecer(dto)).rejects.toMatchObject({
        status: 410,
        response: { code: 'RESET_LINK_EXPIRED' },
      });
      expect(tx.user.update).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rechaza la confirmación diferente sin consultar el token', async () => {
    const { servicio, tx, dto } = preparar();
    await expect(
      servicio.restablecer({ ...dto, passwordConfirmation: 'Distinta123' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { errors: { passwordConfirmation: expect.any(Array) } },
    });
    expect(tx.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });

  it('el mismo enlace solo cambia una vez el hash Argon2id y revoca las sesiones dentro de la transacción', async () => {
    const { servicio, tx, dto, sesiones } = preparar();
    tx.passwordResetToken.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await servicio.restablecer(dto);
    await expect(servicio.restablecer(dto)).rejects.toMatchObject({ status: 410 });
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    const hash = tx.user.update.mock.calls[0][0].data.passwordHash;
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(hash, dto.password)).toBe(true);
    expect(sesiones.revokeAllForUser).toHaveBeenCalledExactlyOnceWith('u', tx);
  });
});
