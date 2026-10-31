import { Module } from '@nestjs/common';
import { ConfirmationMailer, LoggerConfirmationMailer } from './confirmation-mailer';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
  controllers: [IdentityController],
  providers: [IdentityService, { provide: ConfirmationMailer, useClass: LoggerConfirmationMailer }],
  exports: [IdentityService],
})
export class IdentityModule {}
