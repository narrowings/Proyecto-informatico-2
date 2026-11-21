import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '../common/auth/authenticated.guard';
import { CurrentUser, type AuthUser } from '../common/auth/current-user.decorator';
import { PaginacionDto } from '../common/http/paginacion.dto';
import { uuidPipe } from '../common/http/uuid';
import { validarDto } from '../common/http/validar-dto';
import { CalificacionDto } from './ratings.dto';
import { RatingsService } from './ratings.service';

@Controller()
@UseGuards(AuthenticatedGuard)
export class RatingsController {
  constructor(@Inject(RatingsService) private readonly ratings: RatingsService) {}

  @Post('jobs/:id/ratings')
  calificar(
    @CurrentUser() usuario: AuthUser,
    @Param('id', uuidPipe) id: string,
    @Body(validarDto(CalificacionDto)) dto: CalificacionDto,
  ) {
    return this.ratings.calificar(id, usuario.id, dto);
  }

  @Get('ratings/mine')
  propias(
    @CurrentUser() usuario: AuthUser,
    @Query(validarDto(PaginacionDto)) consulta: PaginacionDto,
  ) {
    return this.ratings.propias(usuario.id, consulta);
  }
}
