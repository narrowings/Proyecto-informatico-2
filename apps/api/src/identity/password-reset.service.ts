import { BadRequestException, GoneException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { transaccionSerializable } from '../prisma/transaccion-serializable';
import { SessionService } from '../session/session.service';
import type { RestablecerContrasenaDto } from './dto/password-reset.dto';
import { PasswordResetMailer } from './password-reset-mailer';
import { createToken, hashToken } from './tokens';

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

const enlaceVencido = () =>
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
    @Inject(SessionService) private readonly sesiones: SessionService,
  ) {}

  programarEnvio(email: string) {
    // La respuesta HTTP no espera consultas ni correo para ninguna cuenta.
    setImmediate(() => {
      void this.enviarEnlace(email).catch(() =>
        this.logger.error('No se pudo procesar la recuperación'),
      );
    });
  }

  async enviarEnlace(email: string) {
    const { token, hash } = createToken();
    const usuario = await transaccionSerializable(this.prisma, async (tx) => {
      const cuenta = await tx.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, status: true },
      });
      if (!cuenta || cuenta.status === 'SUSPENDED') return null;
      const ahora = new Date();
      await tx.passwordResetToken.updateMany({
        where: { userId: cuenta.id, usedAt: null },
        data: { usedAt: ahora },
      });
      await tx.passwordResetToken.create({
        data: {
          userId: cuenta.id,
          tokenHash: hash,
          expiresAt: new Date(ahora.getTime() + PASSWORD_RESET_TTL_MS),
        },
      });
      return cuenta;
    });
    if (!usuario) return;
    const web = this.config.get('WEB_URL', 'http://localhost:3000').replace(/\/$/, '');
    await this.mailer.send({
      to: usuario.email,
      name: usuario.name,
      link: `${web}/restablecer-contrasena?token=${token}`,
    });
  }

  async restablecer({ token, password, passwordConfirmation }: RestablecerContrasenaDto) {
    if (password !== passwordConfirmation) {
      throw new BadRequestException({
        message: 'Revisa los campos marcados',
        errors: { passwordConfirmation: ['Las contraseñas deben coincidir'] },
      });
    }
    const tokenHash = hashToken(token);
    const registro = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, expiresAt: true, usedAt: true, userId: true },
    });
    if (!registro || registro.usedAt || registro.expiresAt <= new Date()) throw enlaceVencido();

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await transaccionSerializable(this.prisma, async (tx) => {
      const ahora = new Date();
      const cambio = await tx.passwordResetToken.updateMany({
        where: { id: registro.id, usedAt: null, expiresAt: { gt: ahora } },
        data: { usedAt: ahora },
      });
      if (!cambio.count) throw enlaceVencido();
      await tx.user.update({ where: { id: registro.userId }, data: { passwordHash } });
      await this.sesiones.revokeAllForUser(registro.userId, tx);
    });
  }
}
