import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { confirmationMailerProvider } from './confirmation-mailer';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
  imports: [MailModule],
  controllers: [IdentityController],
  providers: [IdentityService, confirmationMailerProvider],
  exports: [IdentityService],
})
export class IdentityModule {}
