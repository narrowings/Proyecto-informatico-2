import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { CurrentUser, type AuthUser } from '../common/auth/current-user.decorator';
import { uuidPipe } from '../common/http/uuid';
import { validateDto } from '../common/http/validate-dto';
import {
  AcceptSelectionDto,
  CancelJobDto,
  ListJobsQuery,
  SelectApplicantsDto,
} from './engagements.dto';
import { EngagementsService } from './engagements.service';

@Controller()
@UseGuards(AuthenticatedGuard)
export class EngagementsController {
  constructor(@Inject(EngagementsService) private readonly engagements: EngagementsService) {}

  @Get('opportunities/:id/applicants')
  listApplicants(@CurrentUser() user: AuthUser, @Param('id', uuidPipe) id: string) {
    return this.engagements.listApplicants(id, user.id);
  }

  @Post('opportunities/:id/selections')
  select(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidPipe) id: string,
    @Body(validateDto(SelectApplicantsDto)) dto: SelectApplicantsDto,
  ) {
    return this.engagements.select(id, user.id, dto.applicationIds);
  }

  @Get('selections/mine')
  listOwnSelections(@CurrentUser() user: AuthUser) {
    return this.engagements.listOwnSelections(user.id);
  }

  @Post('selections/:id/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidPipe) id: string,
    @Body(validateDto(AcceptSelectionDto)) dto: AcceptSelectionDto,
  ) {
    return this.engagements.accept(id, user.id, dto.acceptTerms);
  }

  @Post('selections/:id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  reject(@CurrentUser() user: AuthUser, @Param('id', uuidPipe) id: string) {
    return this.engagements.reject(id, user.id);
  }

  @Get('jobs')
  listOwnJobs(
    @CurrentUser() user: AuthUser,
    @Query(validateDto(ListJobsQuery)) query: ListJobsQuery,
  ) {
    return this.engagements.listOwnJobs(user.id, query);
  }

  @Get('jobs/:id')
  getJobDetail(@CurrentUser() user: AuthUser, @Param('id', uuidPipe) id: string) {
    return this.engagements.getJobDetail(id, user.id);
  }

  @Post('jobs/:id/finish')
  @HttpCode(HttpStatus.NO_CONTENT)
  markFinished(@CurrentUser() user: AuthUser, @Param('id', uuidPipe) id: string) {
    return this.engagements.markFinished(id, user.id);
  }

  @Post('jobs/:id/confirm-finish')
  @HttpCode(HttpStatus.NO_CONTENT)
  confirmFinished(@CurrentUser() user: AuthUser, @Param('id', uuidPipe) id: string) {
    return this.engagements.confirmFinished(id, user.id);
  }

  @Post('jobs/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelJob(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidPipe) id: string,
    @Body(validateDto(CancelJobDto)) dto: CancelJobDto,
  ) {
    return this.engagements.cancelJob(id, user.id, dto.reason);
  }
}
