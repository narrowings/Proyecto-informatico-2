import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ProfilesService } from './profiles.service';
import { PublisherProfilesController } from './publisher-profiles.controller';

@Module({
  imports: [IdentityModule],
  controllers: [PublisherProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
