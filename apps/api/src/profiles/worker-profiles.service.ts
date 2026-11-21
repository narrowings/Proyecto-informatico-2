import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { CatalogsService } from '../catalogs/catalogs.service';
import { IdentityService } from '../identity/identity.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateWorkerProfileDto } from './dto/create-worker-profile.dto';
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

  async getPhoto(profileId: string) {
    const photo = await this.prisma.workerPhoto.findUnique({ where: { profileId } });
    if (!photo) throw new NotFoundException('Foto no encontrada');
    return photo;
  }

  private async assertCatalogs(dto: CreateWorkerProfileDto) {
    const [zoneOk, invalidCategories] = await Promise.all([
      this.catalogs.isActiveZone(dto.zoneId),
      this.catalogs.findInvalidCategoryIds(dto.categoryIds),
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
  createdAt: profile.createdAt,
});
