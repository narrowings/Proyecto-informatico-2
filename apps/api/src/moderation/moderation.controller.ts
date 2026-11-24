import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { CurrentUser, type AuthUser } from '../common/auth/current-user.decorator';
import { uuidPipe } from '../common/http/uuid';
import { validateDto } from '../common/http/validate-dto';
import { AdminGuard } from '../audit/admin.guard';
import { ModerationReasonDto, ListReportsQuery, ListUsersQuery } from './moderation.dto';
import { ModerationService } from './moderation.service';
import { ReportTargetType } from '@prisma/client';
import type { AuthenticatedRequest } from '../common/auth/current-user.decorator';

@Controller('admin')
@UseGuards(AuthenticatedGuard, AdminGuard)
export class ModerationController {
  constructor(@Inject(ModerationService) private readonly moderation: ModerationService) {}

  @Get('reports')
  listReports(@Query(validateDto(ListReportsQuery)) query: ListReportsQuery) {
    return this.moderation.listReports(query);
  }

  @Get('reports/:targetType/:targetId')
  reportDetail(
    @Param('targetType') targetType: ReportTargetType,
    @Param('targetId', uuidPipe) targetId: string,
  ) {
    if (!Object.values(ReportTargetType).includes(targetType))
      throw new BadRequestException('El tipo de elemento no es válido');
    return this.moderation.reportDetail(targetType, targetId);
  }

  @Post('opportunities/:id/hide')
  hide(
    @CurrentUser() user: AuthUser,
    @Req() request: AuthenticatedRequest,
    @Param('id', uuidPipe) id: string,
    @Body(validateDto(ModerationReasonDto)) dto: ModerationReasonDto,
  ) {
    return this.moderation.hideOpportunity(user.id, id, dto.reason, request.ip);
  }

  @Post('opportunities/:id/unhide')
  unhide(
    @CurrentUser() user: AuthUser,
    @Req() request: AuthenticatedRequest,
    @Param('id', uuidPipe) id: string,
    @Body(validateDto(ModerationReasonDto)) dto: ModerationReasonDto,
  ) {
    return this.moderation.unhideOpportunity(user.id, id, dto.reason, request.ip);
  }

  @Get('users')
  listUsers(@Query(validateDto(ListUsersQuery)) query: ListUsersQuery) {
    return this.moderation.listUsers(query);
  }

  @Post('users/:id/suspend')
  suspend(
    @CurrentUser() user: AuthUser,
    @Req() request: AuthenticatedRequest,
    @Param('id', uuidPipe) id: string,
    @Body(validateDto(ModerationReasonDto)) dto: ModerationReasonDto,
  ) {
    return this.moderation.suspendUser(user.id, id, dto.reason, request.ip);
  }

  @Post('users/:id/block')
  block(
    @CurrentUser() user: AuthUser,
    @Req() request: AuthenticatedRequest,
    @Param('id', uuidPipe) id: string,
    @Body(validateDto(ModerationReasonDto)) dto: ModerationReasonDto,
  ) {
    return this.moderation.blockUser(user.id, id, dto.reason, request.ip);
  }

  @Post('users/:id/reactivate')
  reactivate(
    @CurrentUser() user: AuthUser,
    @Req() request: AuthenticatedRequest,
    @Param('id', uuidPipe) id: string,
    @Body(validateDto(ModerationReasonDto)) dto: ModerationReasonDto,
  ) {
    return this.moderation.reactivateUser(user.id, id, dto.reason, request.ip);
  }

  @Post('reports/:targetType/:targetId/dismiss')
  dismiss(
    @CurrentUser() user: AuthUser,
    @Req() request: AuthenticatedRequest,
    @Param('targetType') targetType: ReportTargetType,
    @Param('targetId', uuidPipe) targetId: string,
    @Body(validateDto(ModerationReasonDto)) dto: ModerationReasonDto,
  ) {
    if (!Object.values(ReportTargetType).includes(targetType))
      throw new BadRequestException('El tipo de elemento no es válido');
    return this.moderation.dismissReports(user.id, targetType, targetId, dto.reason, request.ip);
  }
}
