import { Module, forwardRef } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { IdentityModule } from '../identity/identity.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RatingsModule } from '../ratings/ratings.module';
import { EngagementsController } from './engagements.controller';
import { EngagementsService } from './engagements.service';
import { SchedulerService } from './scheduler.service';

@Module({
  // OPPORTUNITIES y APPLICATIONS llegan de sus módulos; NOTIFICATIONS es global.
  imports: [
    PrismaModule,
    IdentityModule,
    OpportunitiesModule,
    ApplicationsModule,
    forwardRef(() => RatingsModule),
  ],
  controllers: [EngagementsController],
  providers: [EngagementsService, SchedulerService],
  exports: [EngagementsService],
})
export class EngagementsModule {}
