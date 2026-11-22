import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { passwordResetMailerProvider } from './password-reset-mailer';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [SessionModule],
  controllers: [PasswordResetController],
  providers: [PasswordResetService, passwordResetMailerProvider],
})
export class PasswordResetModule {}
