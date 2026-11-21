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
  private temporizador?: ReturnType<typeof setInterval>;
  private ejecutando = false;

  constructor(
    @Inject(EngagementsService) private readonly engagements: EngagementsService,
    @Inject(RatingsService) private readonly ratings: RatingsService,
  ) {}

  onModuleInit() {
    if (process.env.SCHEDULER_ENABLED === 'false') return;
    // Esta ejecución provisional se migrará a pg-boss.
    this.temporizador = setInterval(() => void this.ejecutar(), SCHEDULER_INTERVAL_MS);
    this.temporizador.unref();
  }

  onModuleDestroy() {
    clearInterval(this.temporizador);
  }

  private async ejecutar() {
    if (this.ejecutando) return;
    this.ejecutando = true;
    try {
      const ahora = new Date();
      const tareas = await Promise.allSettled([
        this.engagements.expireSelections(ahora),
        this.engagements.startDueJobs(ahora),
        this.ratings.publishDueRatings(ahora),
      ]);
      for (const tarea of tareas) {
        if (tarea.status === 'rejected')
          this.logger.error('Falló una transición programada', tarea.reason);
      }
    } finally {
      this.ejecutando = false;
    }
  }
}
