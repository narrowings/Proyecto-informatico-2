import { BadRequestException, GoneException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { serializableTransaction } from '../prisma/serializable-transaction';
import { SessionService } from '../session/session.service';
import type { ResetPasswordDto } from './dto/password-reset.dto';
import { PasswordResetMailer } from './password-reset-mailer';
import { createToken, hashToken } from './tokens';

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

const expiredLink = () =>
  new GoneException({
    code: 'RESET_LINK_EXPIRED',
    message: 'El enlace de recuperación ya no es válido. Solicita uno nuevo',
  });

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordResetMailer) private readonly mailer: PasswordResetMailer,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  scheduleResetEmail(email: string) {
    // La respuesta HTTP no espera consultas ni correo para ninguna cuenta.
    setImmediate(() => {
      void this.sendResetLink(email).catch(() =>
        this.logger.error('No se pudo procesar la recuperación'),
      );
    });
  }

  async sendResetLink(email: string) {
    const { token, hash } = createToken();
    const user = await serializableTransaction(this.prisma, async (tx) => {
      const account = await tx.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, status: true },
      });
      // Una cuenta suspendida o bloqueada por moderación no recupera el acceso por esta vía (HU-012).
      if (!account || account.status === 'SUSPENDED' || account.status === 'BLOCKED') return null;
      const now = new Date();
      await tx.passwordResetToken.updateMany({
        where: { userId: account.id, usedAt: null },
        data: { usedAt: now },
      });
      await tx.passwordResetToken.create({
        data: {
          userId: account.id,
          tokenHash: hash,
          expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
        },
      });
      return account;
    });
    if (!user) return;
    const webUrl = this.config.get('WEB_URL', 'http://localhost:3000').replace(/\/$/, '');
    await this.mailer.send({
      to: user.email,
      name: user.name,
      link: `${webUrl}/restablecer-contrasena?token=${token}`,
    });
  }

  async resetPassword({ token, password, passwordConfirmation }: ResetPasswordDto) {
    if (password !== passwordConfirmation) {
      throw new BadRequestException({
        message: 'Revisa los campos marcados',
        errors: { passwordConfirmation: ['Las contraseñas deben coincidir'] },
      });
    }
    const tokenHash = hashToken(token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, expiresAt: true, usedAt: true, userId: true },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) throw expiredLink();

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await serializableTransaction(this.prisma, async (tx) => {
      const now = new Date();
      const result = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (!result.count) throw expiredLink();
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await this.sessions.revokeAllForUser(record.userId, tx);
    });
  }
}
