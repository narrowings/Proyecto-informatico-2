import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PublisherKind, type PublisherProfile } from '@prisma/client';
import { IdentityService } from '../identity/identity.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePublisherProfileDto } from './dto/create-publisher-profile.dto';
import { parseNit } from './nit';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
  ) {}

  async createPublisherProfile(userId: string, dto: CreatePublisherProfileDto) {
    if (!(await this.identity.isAccountActive(userId))) {
      throw new ForbiddenException('Confirma tu correo antes de crear tu perfil');
    }
    const existing = await this.prisma.publisherProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Ya tienes un perfil de publicador');

    const isCompany = dto.kind === PublisherKind.COMPANY;
    // El DTO ya validó el NIT, así que parseNit no devuelve null aquí.
    const nit = isCompany ? parseNit(dto.nit as string) : null;
    try {
      const profile = await this.prisma.publisherProfile.create({
        data: {
          userId,
          kind: dto.kind,
          displayName: dto.displayName,
          photoUrl: dto.photoUrl,
          description: dto.description,
          ...(isCompany && {
            nit: nit?.base,
            nitCheckDigit: nit?.checkDigit,
            contactName: dto.contactName,
            sector: dto.sector,
          }),
        },
      });
      return toOwnView(profile);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          String(error.meta?.target).includes('nit')
            ? 'Ya existe una empresa registrada con este NIT'
            : 'Ya tienes un perfil de publicador',
        );
      }
      throw error;
    }
  }

  // 404 indica al frontend que debe llevar a crear el perfil (HU-008 CA4, HU-022 CA3).
  async getOwnPublisherProfile(userId: string) {
    const profile = await this.prisma.publisherProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Aún no tienes perfil de publicador');
    return toOwnView(profile);
  }

  // HU-008 CA3 y RF-02-07: solo datos públicos; nunca correo, teléfono, NIT ni contacto.
  async getPublicPublisherProfile(id: string) {
    const profile = await this.prisma.publisherProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Perfil no encontrado');
    return {
      id: profile.id,
      kind: profile.kind,
      displayName: profile.displayName,
      photoUrl: profile.photoUrl,
      description: profile.description,
      sector: profile.sector,
      isVerified: profile.isVerified,
      // La reputación llega con HU-007 y HU-028 (Sprint 3); sin calificaciones: "Nuevo en la plataforma".
      reputation: { average: null, ratingsCount: 0, completedJobs: 0 },
    };
  }

  // Para HU-003 CA4 (Sprint 2): el módulo opportunities exige perfil antes de publicar.
  async hasPublisherProfile(userId: string) {
    const count = await this.prisma.publisherProfile.count({ where: { userId } });
    return count > 0;
  }
}

const toOwnView = (profile: PublisherProfile) => ({
  id: profile.id,
  kind: profile.kind,
  displayName: profile.displayName,
  photoUrl: profile.photoUrl,
  description: profile.description,
  nit: profile.nit ? `${profile.nit}-${profile.nitCheckDigit}` : null,
  contactName: profile.contactName,
  sector: profile.sector,
  isVerified: profile.isVerified,
  createdAt: profile.createdAt,
});
