import { Module } from '@nestjs/common';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { REPORTS } from './reports.contract';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [OpportunitiesModule, ProfilesModule],
  controllers: [ReportsController],
  providers: [ReportsService, { provide: REPORTS, useExisting: ReportsService }],
  exports: [REPORTS, ReportsService],
})
export class ReportsModule {}
