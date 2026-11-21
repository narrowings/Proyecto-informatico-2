import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';

export const EXPIRE_EVERY_MS = 5 * 60 * 1000;

// RF-03-10: revisa cada 5 minutos las publicaciones cuya fecha ya llegó y las pasa a "Vencida".
// Provisional: se reemplaza por una tarea de pg-boss (Documento Tecnológico) cuando exista la cola.
// SCHEDULER_ENABLED=false lo apaga (pruebas o réplicas adicionales).
@Injectable()
export class OpportunitiesScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OpportunitiesScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(@Inject(OpportunitiesService) private readonly opportunities: OpportunitiesService) {}

  onApplicationBootstrap() {
    if (process.env.SCHEDULER_ENABLED === 'false') return;
    void this.run();
    this.timer = setInterval(() => void this.run(), EXPIRE_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async run(now = new Date()) {
    try {
      const expired = await this.opportunities.expireDue(now);
      if (expired > 0) this.logger.log(`${expired} publicaciones pasaron a Vencida`);
    } catch (error) {
      this.logger.error('No se pudieron vencer las publicaciones', error as Error);
    }
  }
}
