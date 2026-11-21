import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { RatingsService } from '../ratings/ratings.service';
import { EngagementsService } from './engagements.service';

export const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private isRunning = false;

  constructor(
    @Inject(EngagementsService) private readonly engagements: EngagementsService,
    @Inject(RatingsService) private readonly ratings: RatingsService,
  ) {}

  onModuleInit() {
    if (process.env.SCHEDULER_ENABLED === 'false') return;
    // Esta ejecución provisional se migrará a pg-boss.
    this.timer = setInterval(() => void this.run(), SCHEDULER_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  private async run() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const now = new Date();
      const tasks = await Promise.allSettled([
        this.engagements.expireSelections(now),
        this.engagements.startDueJobs(now),
        this.ratings.publishDueRatings(now),
      ]);
      for (const task of tasks) {
        if (task.status === 'rejected')
          this.logger.error('Falló una transición programada', task.reason);
      }
    } finally {
      this.isRunning = false;
    }
  }
}
