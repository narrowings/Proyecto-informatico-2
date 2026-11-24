import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { SessionModule } from '../session/session.module';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({
  imports: [OpportunitiesModule, IdentityModule, SessionModule],
  controllers: [ModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}
