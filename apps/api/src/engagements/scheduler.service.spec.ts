import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RatingsService } from '../ratings/ratings.service';
import type { EngagementsService } from './engagements.service';
import { SCHEDULER_INTERVAL_MS, SchedulerService } from './scheduler.service';

function setup() {
  vi.useFakeTimers();
  const engagements = { expireSelections: vi.fn(), startDueJobs: vi.fn() };
  const ratings = { publishDueRatings: vi.fn() };
  const scheduler = new SchedulerService(
    engagements as unknown as EngagementsService,
    ratings as unknown as RatingsService,
  );
  return {
    scheduler,
    tasks: [engagements.expireSelections, engagements.startDueJobs, ratings.publishDueRatings],
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('HU-006, HU-028 y HU-007 Transiciones programadas', () => {
  it('ejecuta las tres tareas con la misma fecha cada cinco minutos y se detiene al cerrar el módulo', async () => {
    vi.stubEnv('SCHEDULER_ENABLED', 'true');
    const { scheduler, tasks } = setup();
    const now = new Date('2026-11-20T12:00:00Z');
    vi.setSystemTime(now);
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(SCHEDULER_INTERVAL_MS - 1);
    for (const task of tasks) expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const expectedTime = new Date(now.getTime() + SCHEDULER_INTERVAL_MS);
    scheduler.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(SCHEDULER_INTERVAL_MS);
    for (const task of tasks) expect(task).toHaveBeenCalledExactlyOnceWith(expectedTime);
  });

  it('omite el temporizador cuando está deshabilitado', async () => {
    vi.stubEnv('SCHEDULER_ENABLED', 'false');
    const { scheduler, tasks } = setup();
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(SCHEDULER_INTERVAL_MS);
    scheduler.onModuleDestroy();
    for (const task of tasks) expect(task).not.toHaveBeenCalled();
  });
});
