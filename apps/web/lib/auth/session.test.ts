import { afterEach, describe, expect, it, vi } from 'vitest';
import { getInactivityTimeoutMs } from './session';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60_000;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getInactivityTimeoutMs', () => {
  it('por defecto son 7 días (RNF-SEG-05)', () => {
    expect(getInactivityTimeoutMs()).toBe(SEVEN_DAYS_MS);
  });

  it('se puede configurar en minutos', () => {
    vi.stubEnv('NEXT_PUBLIC_SESSION_INACTIVITY_MINUTES', '30');
    expect(getInactivityTimeoutMs()).toBe(30 * 60_000);
  });

  it.each(['abc', '0', '-5', ''])('ignora el valor inválido "%s"', (value) => {
    vi.stubEnv('NEXT_PUBLIC_SESSION_INACTIVITY_MINUTES', value);
    expect(getInactivityTimeoutMs()).toBe(SEVEN_DAYS_MS);
  });

  it('no supera el máximo que admite setTimeout', () => {
    vi.stubEnv('NEXT_PUBLIC_SESSION_INACTIVITY_MINUTES', '999999999');
    expect(getInactivityTimeoutMs()).toBe(2_147_483_647);
  });
});
