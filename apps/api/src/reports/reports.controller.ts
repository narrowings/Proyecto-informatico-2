import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { CurrentUser, type AuthUser } from '../common/auth/current-user.decorator';
import { validateDto } from '../common/http/validate-dto';
import { CreateReportDto } from './reports.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @Post()
  @UseGuards(AuthenticatedGuard, ThrottlerGuard)
  @Throttle({ ip: { limit: 10, ttl: 60_000 } })
  @SkipThrottle({ email: true })
  create(@CurrentUser() user: AuthUser, @Body(validateDto(CreateReportDto)) dto: CreateReportDto) {
    return this.reports.create(user.id, dto);
  }
}
