import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { ConfirmEmailDto, ResendConfirmationDto } from './dto/confirmation.dto';
import { RegisterDto } from './dto/register.dto';
import { IdentityService } from './identity.service';

@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('auth/register')
  register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.identity.register(dto, ip);
  }

  @Post('auth/confirm-email')
  @HttpCode(HttpStatus.OK)
  confirmEmail(@Body() dto: ConfirmEmailDto) {
    return this.identity.confirmEmail(dto.token);
  }

  @Post('auth/resend-confirmation')
  @HttpCode(HttpStatus.ACCEPTED)
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
