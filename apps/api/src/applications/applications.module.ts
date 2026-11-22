import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ApplicationsController } from './applications.controller';
import { APPLICATIONS } from './applications.contract';
import { ApplicationsService } from './applications.service';

// NOTIFICATIONS llega del módulo global de notificaciones.
@Module({
  imports: [OpportunitiesModule, ProfilesModule, IdentityModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, { provide: APPLICATIONS, useExisting: ApplicationsService }],
  exports: [ApplicationsService, APPLICATIONS],
})
export class ApplicationsModule {}
