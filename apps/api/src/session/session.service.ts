import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { createToken, hashToken } from '../identity/tokens';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenService } from './access-token.service';
import type { LoginDto } from './dto/login.dto';
import {
  ACCOUNT_SUSPENDED,
  EMAIL_NOT_CONFIRMED,
  INVALID_CREDENTIALS,
  REFRESH_TTL_MS,
  SESSION_EXPIRED,
} from './session.constants';

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class SessionService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessTokens: AccessTokenService,
  ) {}

  // HU-021 CA1, CA2 y CA4.
  async login(dto: LoginDto, meta: SessionMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true, passwordHash: true, status: true },
    });

    // Con correo inexistente también se verifica un hash, para que la respuesta tarde lo mismo.
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const passwordOk = await argon2.verify(hash, dto.password);
    if (!user || !passwordOk) throw new UnauthorizedException(INVALID_CREDENTIALS);

    // Solo se informa el estado de la cuenta a quien ya demostró la contraseña.
    if (user.status === AccountStatus.PENDING_CONFIRMATION) {
      throw new ForbiddenException(EMAIL_NOT_CONFIRMED);
    }
    if (user.status !== AccountStatus.ACTIVE) throw new ForbiddenException(ACCOUNT_SUSPENDED);

    const { token: refreshToken, hash: tokenHash } = createToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId: randomUUID(),
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255),
      },
    });
    const { token: accessToken, expiresIn } = await this.accessTokens.sign(user.id);
    return {
      accessToken,
      expiresIn,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  // HU-021 CA5: cada renovación entrega un token nuevo y vence 7 días después del último uso.
  // Presentar un token ya rotado indica que fue copiado: se revoca toda la familia de sesiones.
  async refresh(refreshToken: string | undefined, meta: SessionMeta) {
    if (!refreshToken) throw new UnauthorizedException(SESSION_EXPIRED);

    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: { select: { id: true, status: true } } },
    });
    if (!current) throw new UnauthorizedException(SESSION_EXPIRED);

    const now = new Date();
    if (
      current.rotatedAt ||
      current.revokedAt ||
      current.expiresAt <= now ||
      current.user.status !== AccountStatus.ACTIVE
    ) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    // Reclama el token con una sola escritura: de dos renovaciones simultáneas gana una.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: current.id, rotatedAt: null, revokedAt: null },
      data: { rotatedAt: now, lastUsedAt: now },
    });
    if (claimed.count === 0) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    const { token: nextToken, hash } = createToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: current.userId,
        familyId: current.familyId,
        tokenHash: hash,
        expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255),
      },
    });
    const { token: accessToken, expiresIn } = await this.accessTokens.sign(current.userId);
    return { accessToken, expiresIn, refreshToken: nextToken };
  }

  // HU-021 CA5: cerrar sesión revoca la familia. Repetirlo, o hacerlo sin cookie, no es un error.
  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { familyId: true },
    });
    if (current) await this.revokeFamily(current.familyId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, status: true },
    });
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    return { id: user.id, name: user.name, email: user.email };
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private getDummyHash() {
    this.dummyHash ??= argon2.hash('contraseña-de-relleno', { type: argon2.argon2id });
    return this.dummyHash;
  }
}