import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { SessionService } from '../session/session.service';
import { PASSWORD_RESET_TTL_MS, PasswordResetService } from './password-reset.service';
import { hashToken } from './tokens';

function setup() {
  const receivedToken = 'enlace';
  const user = { id: 'u', email: 'ana@example.com', name: 'Ana', status: 'ACTIVE' };
  const record = {
    id: 'r',
    userId: 'u',
    usedAt: null,
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  };
  const tx = {
    user: { findUnique: vi.fn().mockResolvedValue(user), update: vi.fn() },
    passwordResetToken: {
      findUnique: vi.fn().mockResolvedValue(record),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn(),
    },
  };
  const email = { send: vi.fn() };
  const sessions = { revokeAllForUser: vi.fn() };
  const service = new PasswordResetService(
    {
      ...tx,
      $transaction: (operation: (client: typeof tx) => unknown) => operation(tx),
    } as unknown as PrismaService,
    email,
    new ConfigService({ WEB_URL: 'https://example.com/' }),
    sessions as unknown as SessionService,
  );
  const dto = { token: receivedToken, password: 'Nueva1234', passwordConfirmation: 'Nueva1234' };
  return { service, tx, email, sessions, record, dto };
}

describe('HU-018 Recuperación de contraseña', () => {
  it('invalida enlaces anteriores y guarda solo el hash del enlace entregado', async () => {
    const { service, tx, email } = setup();
    await service.sendResetLink('ana@example.com');
    const link = new URL(email.send.mock.calls[0][0].link);
    const token = link.searchParams.get('token')!;
    expect(link.pathname).toBe('/restablecer-contrasena');
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
    const { service, tx, email } = setup();
    tx.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ status: 'SUSPENDED' });
    await service.sendResetLink('nadie@example.com');
    await service.sendResetLink('suspendida@example.com');
    expect(email.send).not.toHaveBeenCalled();
    expect(tx.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('el enlace vence a los 30 minutos exactos', async () => {
    const { service, tx, record, dto } = setup();
    const now = new Date('2026-11-20T12:30:00Z');
    vi.setSystemTime(now);
    record.expiresAt = new Date(now.getTime() - PASSWORD_RESET_TTL_MS + 30 * 60_000);
    try {
      await expect(service.resetPassword(dto)).rejects.toMatchObject({
        status: 410,
        response: { code: 'RESET_LINK_EXPIRED' },
      });
      expect(tx.user.update).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rechaza la confirmación diferente sin consultar el token', async () => {
    const { service, tx, dto } = setup();
    await expect(
      service.resetPassword({ ...dto, passwordConfirmation: 'Distinta123' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { errors: { passwordConfirmation: expect.any(Array) } },
    });
    expect(tx.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });

  it('el mismo enlace solo cambia una vez el hash Argon2id y revoca las sesiones dentro de la transacción', async () => {
    const { service, tx, dto, sessions } = setup();
    tx.passwordResetToken.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await service.resetPassword(dto);
    await expect(service.resetPassword(dto)).rejects.toMatchObject({ status: 410 });
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    const hash = tx.user.update.mock.calls[0][0].data.passwordHash;
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(hash, dto.password)).toBe(true);
    expect(sessions.revokeAllForUser).toHaveBeenCalledExactlyOnceWith('u', tx);
  });
});
