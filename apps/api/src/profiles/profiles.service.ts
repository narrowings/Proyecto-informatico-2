import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { Prisma, PublisherKind, type PublisherProfile } from '@prisma/client';
import { IdentityService } from '../identity/identity.service';
import { PrismaService } from '../prisma/prisma.service';
import { EMPTY_REPUTATION, REPUTATION, type ReputationContract } from '../ratings/ratings.contract';
import type {
  CreatePublisherProfileDto,
  PublisherDetailsDto,
} from './dto/create-publisher-profile.dto';
import { parseNit } from './nit';

const duplicateProfile = () =>
  new ConflictException({ code: 'PUBLISHER_EXISTS', message: 'Ya tienes un perfil de publicador' });

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
  ) {}

  createWithPhoto(
    userId: string,
    details: PublisherDetailsDto,
    photo: { buffer: Buffer; mimetype: string },
  ) {
    const id = randomUUID();
    return this.createPublisherProfile(
      userId,
      { ...details, photoUrl: `/v1/profiles/publisher/${id}/photo` },
      {
        id,
        photo: { create: { mediaType: photo.mimetype, content: new Uint8Array(photo.buffer) } },
      },
    );
  }

  async getPhoto(profileId: string) {
    const photo = await this.prisma.publisherPhoto.findUnique({ where: { profileId } });
    if (!photo) throw new NotFoundException('Foto no encontrada');
    return photo;
  }

  async createPublisherProfile(
    userId: string,
    dto: CreatePublisherProfileDto,
    image?: Pick<Prisma.PublisherProfileUncheckedCreateInput, 'id' | 'photo'>,
  ) {
    if (!(await this.identity.isAccountActive(userId))) {
      throw new ForbiddenException('Confirma tu correo antes de crear tu perfil');
    }
    const existing = await this.prisma.publisherProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) throw duplicateProfile();

    const isCompany = dto.kind === PublisherKind.COMPANY;
    // El DTO ya validó el NIT, así que parseNit no devuelve null aquí.
    const nit = isCompany ? parseNit(dto.nit as string) : null;
    try {
      const profile = await this.prisma.publisherProfile.create({
        data: {
          ...image,
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
        if (String(error.meta?.target).includes('nit')) {
          throw new ConflictException({
            code: 'NIT_TAKEN',
            message: 'Ya existe una empresa registrada con este NIT',
          });
        }
        throw duplicateProfile();
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
      // HU-046: sin calificaciones, isNew = true ("Nuevo en la plataforma").
      reputation: await this.reputation(profile.userId),
    };
  }

  private async reputation(userId: string) {
    let ratings: ReputationContract;
    try {
      ratings = this.moduleRef.get<ReputationContract>(REPUTATION, { strict: false });
    } catch {
      // Solo si el módulo de calificaciones no está cargado; un error de consulta sí se propaga.
      return EMPTY_REPUTATION;
    }
    return ratings.getSummary(userId, 'PUBLISHER');
  }

  async getProfileSummary(userId: string) {
    const query = { where: { userId }, select: { id: true } };
    const [worker, publisher] = await Promise.all([
      this.prisma.workerProfile.findUnique(query),
      this.prisma.publisherProfile.findUnique(query),
    ]);
    return {
      hasWorkerProfile: Boolean(worker),
      hasPublisherProfile: Boolean(publisher),
      publisherProfileId: publisher?.id,
      // HU-019: el frontend no ofrece "Reportar" en el propio perfil.
      workerProfileId: worker?.id,
    };
  }

  // Para HU-003 CA4 (Sprint 2): el módulo opportunities exige perfil antes de publicar.
  async hasPublisherProfile(userId: string) {
    const count = await this.prisma.publisherProfile.count({ where: { userId } });
    return count > 0;
  }

  // RF-02-04: opportunities exige perfil de publicador antes de publicar y guarda su id.
  async getPublisherIdForUser(userId: string) {
    const profile = await this.prisma.publisherProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  // Datos públicos del publicador para tarjetas y detalle de oportunidades (RF-02-07: sin contacto).
  async getPublisherCards(ids: string[]) {
    const profiles = await this.prisma.publisherProfile.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, kind: true, displayName: true, photoUrl: true, isVerified: true },
    });
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }

  // Para el contrato de engagements: a quién pertenece un perfil de publicador.
  async getPublisherUserId(profileId: string) {
    const profile = await this.prisma.publisherProfile.findUnique({
      where: { id: profileId },
      select: { userId: true },
    });
    return profile?.userId ?? null;
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
