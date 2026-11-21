import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { CurrentUser, type AuthUser } from '../common/auth/current-user.decorator';
import { uuidPipe } from '../common/http/uuid';
import { validateDto } from '../common/http/validate-dto';
import { ApplicationsService } from './applications.service';
import {
  ApplicationStatusQuery,
  ApplyDto,
  ChangeApplicationStatusDto,
  ListMyApplicationsQuery,
} from './dto/applications.dto';

@Controller()
@UseGuards(AuthenticatedGuard)
export class ApplicationsController {
  constructor(@Inject(ApplicationsService) private readonly applications: ApplicationsService) {}

  // HU-005 CA1 y CA4: "Me interesa" en tareas y "Postularme" en vacantes formales.
  @Post('opportunities/:id/applications')
  apply(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidPipe) opportunityId: string,
    @Body(validateDto(ApplyDto)) dto: ApplyDto,
  ) {
    return this.applications.apply(user.id, opportunityId, dto);
  }

  // HU-024 CA2: postulantes de una vacante formal propia.
  @Get('opportunities/:id/candidates')
  candidates(@CurrentUser() user: AuthUser, @Param('id', uuidPipe) opportunityId: string) {
    return this.applications.listCandidates(user.id, opportunityId);
  }

  // HU-013 CA1: "Postulaciones activas".
  @Get('applications/mine')
  mine(
    @CurrentUser() user: AuthUser,
    @Query(validateDto(ListMyApplicationsQuery)) query: ListMyApplicationsQuery,
  ) {
    return this.applications.listMine(user.id, query);
  }

  // HU-005 CA2: { [opportunityId]: estado } para marcar "Postulado" en las tarjetas.
  @Get('applications/status')
  status(
    @CurrentUser() user: AuthUser,
    @Query(validateDto(ApplicationStatusQuery)) query: ApplicationStatusQuery,
  ) {
    return this.applications.statusFor(user.id, query.opportunityIds);
  }

  // HU-024 CA2–CA3: el publicador cambia el estado y se notifica al postulante.
  @Patch('applications/:id/status')
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidPipe) applicationId: string,
    @Body(validateDto(ChangeApplicationStatusDto)) dto: ChangeApplicationStatusDto,
  ) {
    return this.applications.changeStatus(user.id, applicationId, dto);
  }
}
