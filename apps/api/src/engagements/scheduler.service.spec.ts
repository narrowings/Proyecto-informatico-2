import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RatingsService } from '../ratings/ratings.service';
import type { EngagementsService } from './engagements.service';
import { SCHEDULER_INTERVAL_MS, SchedulerService } from './scheduler.service';

function preparar() {
  vi.useFakeTimers();
  const engagements = { expireSelections: vi.fn(), startDueJobs: vi.fn() };
  const ratings = { publishDueRatings: vi.fn() };
  const scheduler = new SchedulerService(
    engagements as unknown as EngagementsService,
    ratings as unknown as RatingsService,
  );
  return {
    scheduler,
    tareas: [engagements.expireSelections, engagements.startDueJobs, ratings.publishDueRatings],
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('HU-006, HU-028 y HU-007 Transiciones programadas', () => {
  it('ejecuta las tres tareas con la misma fecha cada cinco minutos y se detiene al cerrar el módulo', async () => {
    vi.stubEnv('SCHEDULER_ENABLED', 'true');
    const { scheduler, tareas } = preparar();
    const ahora = new Date('2026-11-20T12:00:00Z');
    vi.setSystemTime(ahora);
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(SCHEDULER_INTERVAL_MS - 1);
    for (const tarea of tareas) expect(tarea).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const horaEsperada = new Date(ahora.getTime() + SCHEDULER_INTERVAL_MS);
    scheduler.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(SCHEDULER_INTERVAL_MS);
    for (const tarea of tareas) expect(tarea).toHaveBeenCalledExactlyOnceWith(horaEsperada);
  });

  it('omite el temporizador cuando está deshabilitado', async () => {
    vi.stubEnv('SCHEDULER_ENABLED', 'false');
    const { scheduler, tareas } = preparar();
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(SCHEDULER_INTERVAL_MS);
    scheduler.onModuleDestroy();
    for (const tarea of tareas) expect(tarea).not.toHaveBeenCalled();
  });
});
