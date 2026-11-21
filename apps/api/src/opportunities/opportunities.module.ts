import { Module } from '@nestjs/common';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { IdentityModule } from '../identity/identity.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { OpportunitiesController } from './opportunities.controller';
import { OPPORTUNITIES } from './opportunities.contract';
import { OpportunitiesScheduler } from './opportunities.scheduler';
import { OpportunitiesService } from './opportunities.service';

@Module({
  imports: [CatalogsModule, ProfilesModule, IdentityModule],
  controllers: [OpportunitiesController],
  providers: [
    OpportunitiesService,
    OpportunitiesScheduler,
    // Contrato para engagements (docs/backend/modulos-y-contratos.md).
    { provide: OPPORTUNITIES, useExisting: OpportunitiesService },
  ],
  exports: [OpportunitiesService, OPPORTUNITIES],
})
export class OpportunitiesModule {}
