import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountStatus, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmationMailer } from './confirmation-mailer';
import type { RegisterDto } from './dto/register.dto';
import { createToken, hashToken } from './tokens';

export const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000; // RF-01-04
export const EMAIL_TAKEN_MESSAGE = 'Este correo ya está registrado. Por favor, inicia sesión';
const LEGAL_DOCUMENT_TYPES = 3; // términos, privacidad y tratamiento de datos

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: ConfirmationMailer,
    private readonly config: ConfigService,
  ) {}

  // HU-001 CA1 y HU-017 CA2: crea la cuenta pendiente, sus consentimientos y el enlace en una sola escritura.
  async register(dto: RegisterDto, ip: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) throw new ConflictException(EMAIL_TAKEN_MESSAGE);

    const legalDocuments = await this.currentLegalDocuments();
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const { token, hash } = createToken();
    const now = new Date();

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          phone: dto.phone.replace(/^\+57/, ''),
          passwordHash,
          ageConfirmedAt: now,
          consents: {
            create: legalDocuments.map((doc) => ({ legalDocumentId: doc.id, acceptedAt: now, ip })),
          },
          confirmationTokens: {
            create: { tokenHash: hash, expiresAt: new Date(now.getTime() + CONFIRMATION_TTL_MS) },
          },
        },
        select: { id: true, name: true, email: true, status: true },
      });
    } catch (error) {
      // Dos registros simultáneos con el mismo correo: gana el primero.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(EMAIL_TAKEN_MESSAGE);
      }
      throw error;
    }

    await this.sendConfirmation(user, token);
    return { id: user.id, email: user.email, status: user.status };
  }

  // HU-001 CA2. Repetir el enlace después de confirmar no es un error.
  async confirmEmail(token: string) {
    const record = await this.prisma.emailConfirmationToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, status: true } } },
    });
    if (record?.user.status === AccountStatus.ACTIVE) return { status: AccountStatus.ACTIVE };
    if (!record || record.usedAt || record.user.status !== AccountStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException({
        code: 'TOKEN_INVALID',
        message: 'El enlace de confirmación no es válido',
      });
    }
    if (record.expiresAt <= new Date()) {
      throw new GoneException({
        code: 'TOKEN_EXPIRED',
        message: 'El enlace de confirmación venció. Solicita uno nuevo',
      });
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.user.id },
        data: { status: AccountStatus.ACTIVE, emailConfirmedAt: now },
      }),
      this.prisma.emailConfirmationToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
    ]);
    return { status: AccountStatus.ACTIVE };
  }

  // HU-001 CA2 y HU-021 CA4. No revela si el correo existe: el controlador siempre responde igual.
  async resendConfirmation(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, status: true },
    });
    if (!user || user.status !== AccountStatus.PENDING_CONFIRMATION) return;

    const { token, hash } = createToken();
    const now = new Date();
    // Solo el último enlace enviado sirve.
    await this.prisma.$transaction([
      this.prisma.emailConfirmationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.emailConfirmationToken.create({
        data: {
          userId: user.id,
          tokenHash: hash,
          expiresAt: new Date(now.getTime() + CONFIRMATION_TTL_MS),
        },
      }),
    ]);
    await this.sendConfirmation(user, token);
  }

  // Versión vigente de cada documento legal: la de mayor fecha de vigencia que ya empezó.
  async currentLegalDocuments() {
    const documents = await this.prisma.legalDocument.findMany({
      where: { effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: 'desc' },
      distinct: ['type'],
      select: { id: true, type: true, version: true, url: true },
    });
    if (documents.length < LEGAL_DOCUMENT_TYPES) {
      throw new InternalServerErrorException('Faltan documentos legales vigentes; ejecuta el seed');
    }
    return documents;
  }

  // RF-01-05: otros módulos consultan el estado de la cuenta por aquí, nunca leen la tabla users.
  async isAccountActive(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    return user?.status === AccountStatus.ACTIVE;
  }

  // Si el correo falla la cuenta ya existe; el usuario puede pedir un enlace nuevo.
  private async sendConfirmation(user: { name: string; email: string }, token: string) {
    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000');
    try {
      await this.mailer.send({
        to: user.email,
        name: user.name,
        link: `${webUrl}/confirmar-correo?token=${token}`,
      });
    } catch (error) {
      this.logger.error('No se pudo enviar el correo de confirmación', error as Error);
    }
  }
}
