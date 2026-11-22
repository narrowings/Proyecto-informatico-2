import { Module } from '@nestjs/common';
import { confirmationMailerProvider } from './confirmation-mailer';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
  controllers: [IdentityController],
  providers: [IdentityService, confirmationMailerProvider],
  exports: [IdentityService],
})
export class IdentityModule {}
