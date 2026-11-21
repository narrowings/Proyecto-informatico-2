import { Body, Controller, HttpCode, HttpStatus, Inject, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { validateDto } from '../common/http/validate-dto';
import { ResetPasswordDto, ForgotPasswordDto } from './dto/password-reset.dto';
import { PasswordResetService } from './password-reset.service';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class PasswordResetController {
  constructor(@Inject(PasswordResetService) private readonly passwordReset: PasswordResetService) {}

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ ip: { limit: 3 }, email: { limit: 3 } })
  forgotPassword(@Body(validateDto(ForgotPasswordDto)) dto: ForgotPasswordDto) {
    this.passwordReset.scheduleResetEmail(dto.email);
    return { message: 'Si el correo está registrado, recibirás un enlace' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ ip: { limit: 5 } })
  @SkipThrottle({ email: true })
  resetPassword(@Body(validateDto(ResetPasswordDto)) dto: ResetPasswordDto) {
    return this.passwordReset.resetPassword(dto);
  }
}
