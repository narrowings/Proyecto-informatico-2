import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountStatus, LegalDocumentType, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { AUDIT, type AuditContract } from '../audit/audit.contract';
import { mailErrorCode } from '../common/mail/pending-mail';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmationMailer } from './confirmation-mailer';
import type { ConsentsDto, LegalVersionsDto, RegisterDto } from './dto/register.dto';
import { createToken, hashToken } from './tokens';

export const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000; // RF-01-04
export const EMAIL_TAKEN_MESSAGE = 'Este correo ya está registrado. Por favor, inicia sesión';

// Campo del registro que trae la versión aceptada de cada documento legal.
const CONSENT_FIELD: Record<LegalDocumentType, Exclude<keyof ConsentsDto, 'isAdult'>> = {
  TERMS: 'terms',
  PRIVACY_POLICY: 'privacy',
  DATA_TREATMENT: 'dataProcessing',
};
const LEGAL_DOCUMENT_TYPES = Object.keys(CONSENT_FIELD).length;

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfirmationMailer) private readonly mailer: ConfirmationMailer,
    @Inject(ConfigService) private readonly config: ConfigService,
    // HU-038 CA1: la aceptación de términos queda en la auditoría. Opcional solo para pruebas aisladas.
    @Optional() @Inject(AUDIT) private readonly audit?: AuditContract,
  ) {}

  // HU-001 CA1 y HU-017 CA2: crea la cuenta pendiente, sus consentimientos y el enlace en una sola escritura.
  async register(dto: RegisterDto, ip: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) throw new ConflictException(EMAIL_TAKEN_MESSAGE);

    const legalDocuments = await this.acceptedVersions(dto.consents);

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const { token, hash } = createToken();
    const now = new Date();

    let user;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            phone: dto.phone.replace(/^\+57/, ''),
            passwordHash,
            ageConfirmedAt: now,
            consents: {
              create: legalDocuments.map((doc) => ({
                legalDocumentId: doc.id,
                acceptedAt: now,
                ip,
              })),
            },
            confirmationTokens: {
              create: { tokenHash: hash, expiresAt: new Date(now.getTime() + CONFIRMATION_TTL_MS) },
            },
          },
          select: { id: true, name: true, email: true, status: true },
        });
        await this.recordTermsAccepted(created.id, legalDocuments, ip, tx);
        return created;
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

  private async acceptedVersions(versions: LegalVersionsDto) {
    const legalDocuments = await this.currentLegalDocuments();
    // HU-017 CA2: solo se deja constancia de la versión que el usuario vio. Si se publicó una nueva
    // mientras llenaba el formulario, el frontend debe mostrarla de nuevo.
    if (legalDocuments.some((doc) => versions[CONSENT_FIELD[doc.type]] !== doc.version)) {
      throw new ConflictException({
        code: 'VERSION_LEGAL_DESACTUALIZADA',
        message: 'Los documentos legales se actualizaron. Revísalos y acéptalos de nuevo',
        current: legalDocuments.map(({ type, version, url }) => ({ type, version, url })),
      });
    }

    return legalDocuments;
  }

  async requiresTermsAcceptance(userId: string) {
    const current = await this.currentLegalDocuments();
    const count = await this.prisma.consent.count({
      where: { userId, legalDocumentId: { in: current.map((doc) => doc.id) } },
    });
    return count < current.length;
  }

  async acceptTerms(userId: string, versions: LegalVersionsDto, ip: string) {
    const current = await this.acceptedVersions(versions);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.consent.createMany({
        data: current.map((doc) => ({ userId, legalDocumentId: doc.id, ip })),
        skipDuplicates: true,
      });
      // Repetir la aceptación de versiones ya aceptadas no es un evento nuevo.
      if (count > 0) await this.recordTermsAccepted(userId, current, ip, tx);
    });
  }

  private recordTermsAccepted(
    userId: string,
    documents: { type: LegalDocumentType; version: string }[],
    ip: string,
    tx: Prisma.TransactionClient,
  ) {
    return this.audit?.record(
      {
        actorUserId: userId,
        action: 'TERMS_ACCEPTED',
        targetType: 'user',
        targetId: userId,
        ip,
        data: Object.fromEntries(documents.map((doc) => [doc.type, doc.version])),
      },
      tx,
    );
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

  async hasCurrentCredential(userId: string, passwordHash: string, tx: Prisma.TransactionClient) {
    return Boolean(
      await tx.user.findUnique({
        where: { id: userId, passwordHash, status: AccountStatus.ACTIVE },
        select: { id: true },
      }),
    );
  }

  getNotificationRecipient(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId, status: AccountStatus.ACTIVE },
      select: { name: true, email: true },
    });
  }

  getContact(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, phone: true },
    });
  }

  // AdminGuard (HU-012 CA2): rol y estado leídos de la base en cada petición.
  getAccess(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
  }

  // HU-012 CA3: búsqueda de usuarios para el panel de administración (por nombre o correo).
  // Solo la usa el módulo de moderación detrás de AdminGuard: por eso incluye el correo.
  async searchUsers({
    q,
    status,
    page,
    pageSize,
  }: {
    q?: string;
    status?: AccountStatus;
    page: number;
    pageSize: number;
  }) {
    const text = q?.trim();
    const where: Prisma.UserWhereInput = {
      ...(status && { status }),
      ...(text && {
        OR: [
          { name: { contains: text, mode: 'insensitive' } },
          { email: { contains: text.toLowerCase() } },
        ],
      }),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, status: true, role: true, createdAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  // HU-012 CA1/CA3: suspender, bloquear o reactivar. Condicional al estado anterior para que dos
  // administradores a la vez no se pisen; devuelve false si el estado ya no era `from`.
  // No toca sesiones ni auditoría: lo hace el módulo de moderación (revoca sesiones y registra).
  async setAccountStatus(
    userId: string,
    from: AccountStatus[],
    to: AccountStatus,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const { count } = await tx.user.updateMany({
      where: { id: userId, status: { in: from } },
      data: { status: to },
    });
    return count === 1;
  }

  // HU-012 CA1: resumen de las cuentas reportadas para la cola de moderación (detrás de AdminGuard).
  async getUsersForModeration(ids: string[]) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, name: true, email: true, status: true, role: true, createdAt: true },
    });
    return new Map(users.map((user) => [user.id, user]));
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
      // Solo el código: el mensaje del servidor SMTP puede traer el correo del destinatario.
      this.logger.error(`No se pudo enviar el correo de confirmación (${mailErrorCode(error)})`);
    }
  }
}
