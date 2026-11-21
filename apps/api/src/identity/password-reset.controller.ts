import { Body, Controller, HttpCode, HttpStatus, Inject, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { validarDto } from '../common/http/validar-dto';
import { RestablecerContrasenaDto, SolicitarRestablecimientoDto } from './dto/password-reset.dto';
import { PasswordResetService } from './password-reset.service';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class PasswordResetController {
  constructor(@Inject(PasswordResetService) private readonly recuperacion: PasswordResetService) {}

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ ip: { limit: 3 }, email: { limit: 3 } })
  solicitar(@Body(validarDto(SolicitarRestablecimientoDto)) dto: SolicitarRestablecimientoDto) {
    this.recuperacion.programarEnvio(dto.email);
    return { message: 'Si el correo está registrado, recibirás un enlace' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ ip: { limit: 5 } })
  @SkipThrottle({ email: true })
  restablecer(@Body(validarDto(RestablecerContrasenaDto)) dto: RestablecerContrasenaDto) {
    return this.recuperacion.restablecer(dto);
  }
}
