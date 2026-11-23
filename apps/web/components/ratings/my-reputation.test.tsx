import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyRatings, ReceivedRating, Reputation } from '@/lib/api';
import { MyReputation } from './my-reputation';

const getMyRatings = vi.fn();
vi.mock('@/lib/api', () => ({
  ratingsApi: { getMyRatings: (...args: unknown[]) => getMyRatings(...args) },
}));

const reputation = (overrides: Partial<Reputation> = {}): Reputation => ({
  average: 4.5,
  fulfillment: 4.5,
  punctuality: 4.5,
  communication: 4.5,
  quality: 4.5,
  ratingsCount: 2,
  completedJobs: 2,
  isNew: false,
  recentComments: [],
  ...overrides,
});

const rating = (id: string, overrides: Partial<ReceivedRating> = {}): ReceivedRating => ({
  id,
  fulfillment: 5,
  punctuality: 4,
  communication: 5,
  quality: 4,
  comment: 'Excelente trabajo',
  rateeRole: 'WORKER',
  jobId: 'j1',
  publishedAt: '2026-11-20T15:00:00.000Z',
  ...overrides,
});

const page = (items: ReceivedRating[], total: number, n = 1): MyRatings => ({
  worker: reputation(),
  publisher: reputation({ average: null, isNew: true, ratingsCount: 0 }),
  ratings: { items, total, page: n, pageSize: 10 },
});

beforeEach(() => getMyRatings.mockReset());

describe('MyReputation', () => {
  it('muestra la reputación en cada rol y las calificaciones recibidas (HU-046, HU-013 CA3)', async () => {
    getMyRatings.mockResolvedValue(page([rating('r1')], 1));
    render(<MyReputation />);

    expect(await screen.findByRole('heading', { name: 'Mi reputación' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Como trabajador' })).toHaveTextContent('4,5');
    expect(screen.getByRole('region', { name: 'Como publicador' })).toHaveTextContent(
      'Nuevo en la plataforma',
    );
    expect(screen.getByText('“Excelente trabajo”')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver más/i })).not.toBeInTheDocument();
  });

  it('carga más calificaciones por páginas', async () => {
    getMyRatings
      .mockResolvedValueOnce(page([rating('r1')], 2))
      .mockResolvedValueOnce(page([rating('r2', { comment: 'Buena comunicación' })], 2, 2));
    const user = userEvent.setup();
    render(<MyReputation />);

    await user.click(await screen.findByRole('button', { name: /ver más calificaciones/i }));
    expect(await screen.findByText('“Buena comunicación”')).toBeInTheDocument();
    expect(getMyRatings).toHaveBeenLastCalledWith(2, 10);
    expect(screen.queryByRole('button', { name: /ver más/i })).not.toBeInTheDocument();
  });

  it('sin calificaciones explica cuándo se publican', async () => {
    getMyRatings.mockResolvedValue(page([], 0));
    render(<MyReputation />);
    expect(await screen.findByText(/aún no tienes calificaciones publicadas/i)).toBeInTheDocument();
  });
});
