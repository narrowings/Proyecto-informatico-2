import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { CatalogsService } from '../catalogs/catalogs.service';
import { IdentityService } from '../identity/identity.service';
import { PrismaService } from '../prisma/prisma.service';
import { EMPTY_REPUTATION, REPUTATION, type ReputationContract } from '../ratings/ratings.contract';
import type { CreateWorkerProfileDto } from './dto/create-worker-profile.dto';
import type { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import type { UploadedPhoto } from './photo';

const duplicateProfile = () =>
  new ConflictException({ code: 'WORKER_EXISTS', message: 'Ya tienes un perfil de trabajador' });

const ownSelect = {
  id: true,
  displayName: true,
  photoUrl: true,
  skills: true,
  experience: true,
  zoneId: true,
  availability: true,
  showPhoto: true,
  showExperience: true,
  createdAt: true,
  zone: { select: { id: true, name: true } },
  categories: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
} satisfies Prisma.WorkerProfileSelect;

type OwnRecord = Prisma.WorkerProfileGetPayload<{ select: typeof ownSelect }>;

// HU-002: perfil de trabajador. El dueño ve su perfil completo; el perfil público llega con HU-029.
@Injectable()
export class WorkerProfilesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(CatalogsService) private readonly catalogs: CatalogsService,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
  ) {}

  async create(userId: string, dto: CreateWorkerProfileDto, photo: UploadedPhoto) {
    // HU-001 CA1: una cuenta sin confirmar no puede crear perfil.
    if (!(await this.identity.isAccountActive(userId))) {
      throw new ForbiddenException('Confirma tu correo antes de crear tu perfil');
    }
    const existing = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) throw duplicateProfile();
    await this.assertCatalogs(dto);

    const id = randomUUID();
    try {
      const profile = await this.prisma.workerProfile.create({
        data: {
          id,
          userId,
          displayName: dto.displayName,
          photoUrl: `/v1/profiles/worker/${id}/photo`,
          skills: dto.skills,
          experience: dto.experience ? dto.experience : null,
          zoneId: dto.zoneId,
          // HU-002 CA1: al crear el perfil queda "Disponible" (valor por defecto del modelo).
          categories: {
            connect: [...new Set(dto.categoryIds)].map((categoryId) => ({ id: categoryId })),
          },
          photo: { create: { mediaType: photo.mimetype, content: new Uint8Array(photo.buffer) } },
        },
        select: ownSelect,
      });
      return toOwnView(profile);
    } catch (error) {
      // Dos envíos simultáneos: el índice único de user_id deja pasar solo uno.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw duplicateProfile();
      }
      throw error;
    }
  }

  // 404 indica al frontend que debe llevar a crear el perfil (HU-022 CA3).
  async getOwn(userId: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: ownSelect,
    });
    if (!profile) throw new NotFoundException('Aún no tienes perfil de trabajador');
    return toOwnView(profile);
  }

  // HU-032 CA1–CA2 y HU-030 CA4. Cambiar a "No disponible" conserva las postulaciones vigentes.
  async update(userId: string, dto: UpdateWorkerProfileDto) {
    const current = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('Aún no tienes perfil de trabajador');
    await this.assertCatalogs(dto);
    const profile = await this.prisma.workerProfile.update({
      where: { userId },
      data: {
        displayName: dto.displayName,
        skills: dto.skills,
        // Vacía la borra; ausente la deja igual.
        experience: dto.experience === undefined ? undefined : dto.experience || null,
        zoneId: dto.zoneId,
        availability: dto.availability,
        showPhoto: dto.showPhoto,
        showExperience: dto.showExperience,
        ...(dto.categoryIds && {
          categories: { set: [...new Set(dto.categoryIds)].map((id) => ({ id })) },
        }),
      },
      select: ownSelect,
    });
    return toOwnView(profile);
  }

  // La URL cambia con cada foto para que navegadores y CDN no muestren la anterior.
  async replacePhoto(userId: string, photo: UploadedPhoto) {
    const current = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('Aún no tienes perfil de trabajador');
    const content = new Uint8Array(photo.buffer);
    const profile = await this.prisma.workerProfile.update({
      where: { id: current.id },
      data: {
        photoUrl: `/v1/profiles/worker/${current.id}/photo?v=${Date.now()}`,
        photo: {
          upsert: {
            create: { mediaType: photo.mimetype, content },
            update: { mediaType: photo.mimetype, content },
          },
        },
      },
      select: ownSelect,
    });
    return toOwnView(profile);
  }

  // HU-029 CA1–CA4 y HU-030: perfil público. Lista blanca: sin correo, teléfono ni dirección; la foto
  // y la experiencia solo si el trabajador eligió mostrarlas.
  async getPublic(id: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { id },
      select: { ...ownSelect, userId: true },
    });
    if (!profile) throw new NotFoundException('Perfil no encontrado');
    return {
      id: profile.id,
      displayName: profile.displayName,
      photoUrl: profile.showPhoto ? profile.photoUrl : null,
      skills: profile.skills,
      experience: profile.showExperience ? profile.experience : null,
      zone: profile.zone,
      categories: profile.categories,
      availability: profile.availability,
      reputation: await this.reputation(profile.userId),
    };
  }

  // Para applications (HU-005 CA5) y engagements: perfil de trabajador del usuario, si existe.
  async getIdForUser(userId: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  // RF-05-06: lo que ve el publicador de cada interesado. Respeta la preferencia de foto.
  async getCards(ids: string[]) {
    const profiles = await this.prisma.workerProfile.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: {
        id: true,
        userId: true,
        displayName: true,
        photoUrl: true,
        showPhoto: true,
        availability: true,
        skills: true,
        zone: { select: { id: true, name: true } },
      },
    });
    return new Map(
      profiles.map(({ showPhoto, photoUrl, ...profile }) => [
        profile.id,
        { ...profile, photoUrl: showPhoto ? photoUrl : null },
      ]),
    );
  }

  async getPhoto(profileId: string) {
    const photo = await this.prisma.workerPhoto.findUnique({ where: { profileId } });
    if (!photo) throw new NotFoundException('Foto no encontrada');
    return photo;
  }

  private async reputation(userId: string) {
    let ratings: ReputationContract;
    try {
      ratings = this.moduleRef.get<ReputationContract>(REPUTATION, { strict: false });
    } catch {
      // Solo si el módulo de calificaciones no está cargado; un error de consulta sí se propaga.
      return EMPTY_REPUTATION;
    }
    return ratings.getSummary(userId, 'WORKER');
  }

  // Solo valida lo que llegó: en una edición parcial los campos ausentes no se revisan.
  private async assertCatalogs(
    dto: Partial<Pick<CreateWorkerProfileDto, 'zoneId' | 'categoryIds'>>,
  ) {
    const [zoneOk, invalidCategories] = await Promise.all([
      dto.zoneId === undefined ? true : this.catalogs.isActiveZone(dto.zoneId),
      dto.categoryIds === undefined ? [] : this.catalogs.findInvalidCategoryIds(dto.categoryIds),
    ]);
    const errors: Record<string, string[]> = {};
    if (!zoneOk) errors.zoneId = ['Elige una zona de Cali de la lista'];
    if (invalidCategories.length > 0) {
      errors.categoryIds = ['Alguna categoría elegida ya no está disponible'];
    }
    if (Object.keys(errors).length > 0) {
      throw new BadRequestException({ message: 'Revisa los campos marcados', errors });
    }
  }
}

const toOwnView = (profile: OwnRecord) => ({
  id: profile.id,
  displayName: profile.displayName,
  photoUrl: profile.photoUrl,
  skills: profile.skills,
  experience: profile.experience,
  zoneId: profile.zoneId,
  zone: profile.zone,
  categoryIds: profile.categories.map((category) => category.id),
  categories: profile.categories,
  availability: profile.availability,
  showPhoto: profile.showPhoto,
  showExperience: profile.showExperience,
  createdAt: profile.createdAt,
});
