import { Module, forwardRef } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RatingsModule } from '../ratings/ratings.module';
import { EngagementsController } from './engagements.controller';
import { EngagementsService } from './engagements.service';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [PrismaModule, IdentityModule, forwardRef(() => RatingsModule)],
  controllers: [EngagementsController],
  providers: [EngagementsService, SchedulerService],
  exports: [EngagementsService],
})
export class EngagementsModule {}
