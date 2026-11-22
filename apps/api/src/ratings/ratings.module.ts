import { Module, forwardRef } from '@nestjs/common';
import { EngagementsModule } from '../engagements/engagements.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RatingsController } from './ratings.controller';
import { REPUTATION } from './ratings.contract';
import { RatingsService } from './ratings.service';

@Module({
  imports: [PrismaModule, forwardRef(() => EngagementsModule)],
  controllers: [RatingsController],
  providers: [RatingsService, { provide: REPUTATION, useExisting: RatingsService }],
  exports: [RatingsService, REPUTATION],
})
export class RatingsModule {}
