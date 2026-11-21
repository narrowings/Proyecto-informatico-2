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
import { validarDto } from '../common/http/validar-dto';
import {
  AceptarSeleccionDto,
  CancelarTrabajoDto,
  ListarTrabajosDto,
  SeleccionarDto,
} from './engagements.dto';
import { EngagementsService } from './engagements.service';

@Controller()
@UseGuards(AuthenticatedGuard)
export class EngagementsController {
  constructor(@Inject(EngagementsService) private readonly engagements: EngagementsService) {}

  @Get('opportunities/:id/applicants')
  aspirantes(@CurrentUser() usuario: AuthUser, @Param('id', uuidPipe) id: string) {
    return this.engagements.aspirantes(id, usuario.id);
  }

  @Post('opportunities/:id/selections')
  seleccionar(
    @CurrentUser() usuario: AuthUser,
    @Param('id', uuidPipe) id: string,
    @Body(validarDto(SeleccionarDto)) dto: SeleccionarDto,
  ) {
    return this.engagements.seleccionar(id, usuario.id, dto.applicationIds);
  }

  @Get('selections/mine')
  propias(@CurrentUser() usuario: AuthUser) {
    return this.engagements.seleccionesPropias(usuario.id);
  }

  @Post('selections/:id/accept')
  @HttpCode(HttpStatus.OK)
  aceptar(
    @CurrentUser() usuario: AuthUser,
    @Param('id', uuidPipe) id: string,
    @Body(validarDto(AceptarSeleccionDto)) dto: AceptarSeleccionDto,
  ) {
    return this.engagements.aceptar(id, usuario.id, dto.acceptTerms);
  }

  @Post('selections/:id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  rechazar(@CurrentUser() usuario: AuthUser, @Param('id', uuidPipe) id: string) {
    return this.engagements.rechazar(id, usuario.id);
  }

  @Get('jobs')
  trabajos(
    @CurrentUser() usuario: AuthUser,
    @Query(validarDto(ListarTrabajosDto)) consulta: ListarTrabajosDto,
  ) {
    return this.engagements.trabajosPropios(usuario.id, consulta);
  }

  @Get('jobs/:id')
  detalle(@CurrentUser() usuario: AuthUser, @Param('id', uuidPipe) id: string) {
    return this.engagements.detalleTrabajo(id, usuario.id);
  }

  @Post('jobs/:id/finish')
  @HttpCode(HttpStatus.NO_CONTENT)
  terminar(@CurrentUser() usuario: AuthUser, @Param('id', uuidPipe) id: string) {
    return this.engagements.marcarTerminado(id, usuario.id);
  }

  @Post('jobs/:id/confirm-finish')
  @HttpCode(HttpStatus.NO_CONTENT)
  confirmar(@CurrentUser() usuario: AuthUser, @Param('id', uuidPipe) id: string) {
    return this.engagements.confirmarTerminado(id, usuario.id);
  }

  @Post('jobs/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelar(
    @CurrentUser() usuario: AuthUser,
    @Param('id', uuidPipe) id: string,
    @Body(validarDto(CancelarTrabajoDto)) dto: CancelarTrabajoDto,
  ) {
    return this.engagements.cancelarTrabajo(id, usuario.id, dto.reason);
  }
}
