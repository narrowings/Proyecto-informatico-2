import { Module } from '@nestjs/common';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { IdentityModule } from '../identity/identity.module';
import { ProfilesService } from './profiles.service';
import { PublisherProfilesController } from './publisher-profiles.controller';
import { WorkerProfilesController } from './worker-profiles.controller';
import { WorkerProfilesService } from './worker-profiles.service';

@Module({
  imports: [IdentityModule, CatalogsModule],
  controllers: [PublisherProfilesController, WorkerProfilesController],
  providers: [ProfilesService, WorkerProfilesService],
  exports: [ProfilesService, WorkerProfilesService],
})
export class ProfilesModule {}
