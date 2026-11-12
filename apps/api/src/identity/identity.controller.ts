import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ConfirmEmailDto, ResendConfirmationDto } from './dto/confirmation.dto';
import { RegisterDto } from './dto/register.dto';
import { IdentityService } from './identity.service';

@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  // RNF-SEG-08: máximo 5 registros por IP cada 15 minutos. La IP real llega por trust proxy (main.ts).
  @Post('auth/register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ ip: { limit: 5 } })
  @SkipThrottle({ email: true })
  register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.identity.register(dto, ip);
  }

  @Post('auth/confirm-email')
  @HttpCode(HttpStatus.OK)
  confirmEmail(@Body() dto: ConfirmEmailDto) {
    return this.identity.confirmEmail(dto.token);
  }

  // RNF-SEG-08: máximo 3 reenvíos por IP y 3 por correo cada 15 minutos.
  @Post('auth/resend-confirmation')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ ip: { limit: 3 }, email: { limit: 3 } })
  async resendConfirmation(@Body() dto: ResendConfirmationDto) {
    await this.identity.resendConfirmation(dto.email);
    return { message: 'Si la cuenta está pendiente de confirmación, enviamos un enlace nuevo' };
  }

  // Enlaces y versiones que muestra el formulario de registro (HU-017 CA1).
  @Get('legal-documents/current')
  currentLegalDocuments() {
    return this.identity.currentLegalDocuments();
  }
}
