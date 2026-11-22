import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { CurrentUser, type AuthUser } from '../common/auth/current-user.decorator';
import { PaginationDto } from '../common/http/pagination.dto';
import { uuidPipe } from '../common/http/uuid';
import { validateDto } from '../common/http/validate-dto';
import { CreateRatingDto } from './ratings.dto';
import { RatingsService } from './ratings.service';

@Controller()
@UseGuards(AuthenticatedGuard)
export class RatingsController {
  constructor(@Inject(RatingsService) private readonly ratings: RatingsService) {}

  @Post('jobs/:id/ratings')
  rate(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidPipe) id: string,
    @Body(validateDto(CreateRatingDto)) dto: CreateRatingDto,
  ) {
    return this.ratings.rate(id, user.id, dto);
  }

  @Get('ratings/mine')
  listOwn(@CurrentUser() user: AuthUser, @Query(validateDto(PaginationDto)) query: PaginationDto) {
    return this.ratings.listOwn(user.id, query);
  }
}
