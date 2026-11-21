import { Module, forwardRef } from '@nestjs/common';
import { EngagementsModule } from '../engagements/engagements.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [PrismaModule, forwardRef(() => EngagementsModule)],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
