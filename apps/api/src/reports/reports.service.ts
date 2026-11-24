import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReportTargetType } from '@prisma/client';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { ProfilesService } from '../profiles/profiles.service';
import { WorkerProfilesService } from '../profiles/worker-profiles.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ReportsContract } from './reports.contract';
import type { CreateReportDto } from './reports.dto';

const cannotReportSelf = () =>
  new BadRequestException({
    code: 'CANNOT_REPORT_SELF',
    message: 'No puedes reportarte a ti mismo',
  });
const alreadyReported = () =>
  new ConflictException({ code: 'ALREADY_REPORTED', message: 'Ya reportaste este elemento' });

@Injectable()
export class ReportsService implements ReportsContract {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OpportunitiesService) private readonly opportunities: OpportunitiesService,
    @Inject(ProfilesService) private readonly profiles: ProfilesService,
    @Inject(WorkerProfilesService) private readonly workers: WorkerProfilesService,
  ) {}

  async create(reporterUserId: string, dto: CreateReportDto) {
    if (
      (dto.targetType === ReportTargetType.USER && !dto.profileKind) ||
      (dto.targetType !== ReportTargetType.USER && dto.profileKind)
    ) {
      throw new BadRequestException({
        message: 'Revisa los campos marcados',
        errors: { profileKind: ['El tipo de perfil solo aplica al reporte de un usuario'] },
      });
    }
    const targetId = await this.resolveTarget(reporterUserId, dto);
    try {
      const report = await this.prisma.report.create({
        data: {
          reporterUserId,
          targetType: dto.targetType,
          targetId,
          reason: dto.reason,
          description: dto.description ?? null,
        },
        select: { id: true },
      });
      return { id: report.id, message: 'Gracias por tu reporte. Nuestro equipo lo revisará.' };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw alreadyReported();
      }
      throw error;
    }
  }

  listReportedTargetIds(userId: string, targetType: ReportTargetType) {
    return this.prisma.report
      .findMany({ where: { reporterUserId: userId, targetType }, select: { targetId: true } })
      .then((reports) => reports.map((report) => report.targetId));
  }

  private async resolveTarget(reporterUserId: string, dto: CreateReportDto) {
    if (dto.targetType === ReportTargetType.OPPORTUNITY) {
      const opportunity = await this.opportunities.getPublic(dto.targetId);
      const ownerId = opportunity.publisher
        ? await this.profiles.getPublisherUserId(opportunity.publisher.id)
        : null;
      if (ownerId === reporterUserId) throw cannotReportSelf();
      return dto.targetId;
    }
    const userId =
      dto.profileKind === 'PUBLISHER'
        ? await this.profiles.getPublisherUserId(dto.targetId)
        : await this.workers.getWorkerUserId(dto.targetId);
    if (!userId) throw new NotFoundException('Perfil no encontrado');
    if (userId === reporterUserId) throw cannotReportSelf();
    return userId;
  }
}
