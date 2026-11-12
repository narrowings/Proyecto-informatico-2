import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_EXPIRED_REASON } from '@/lib/auth/session';
import { ROUTES } from '@/lib/routes';
import { SessionGuard } from './session-guard';

const replace = vi.fn();
const logout = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api', () => ({ authApi: { logout: (...args: unknown[]) => logout(...args) } }));

beforeEach(() => {
  vi.useFakeTimers();
  replace.mockReset();
  logout.mockReset();
  logout.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SessionGuard', () => {
  it('cierra la sesión por inactividad y pide iniciar sesión de nuevo (HU-021 CA5)', async () => {
    render(<SessionGuard timeoutMs={1000} />);
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(`${ROUTES.login}?motivo=${SESSION_EXPIRED_REASON}`);
  });

  it('la actividad del usuario reinicia el conteo', async () => {
    render(<SessionGuard timeoutMs={1000} />);
    await act(() => vi.advanceTimersByTimeAsync(600));
    fireEvent.keyDown(window);
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(replace).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('aunque el servidor no responda, igual lleva a iniciar sesión', async () => {
    logout.mockRejectedValue(new Error('sin red'));
    render(<SessionGuard timeoutMs={1000} />);
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(replace).toHaveBeenCalledWith(`${ROUTES.login}?motivo=${SESSION_EXPIRED_REASON}`);
  });

  it('al desmontarse deja de contar', async () => {
    const { unmount } = render(<SessionGuard timeoutMs={1000} />);
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(5000));

    expect(logout).not.toHaveBeenCalled();
  });
});
