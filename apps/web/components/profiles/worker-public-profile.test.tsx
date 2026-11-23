import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicWorkerProfile, Reputation } from '@/lib/api';
import { WorkerPublicProfile } from './worker-public-profile';

const getPublicWorkerProfile = vi.fn();
vi.mock('@/lib/api', () => ({
  profilesApi: { getPublicWorkerProfile: (...args: unknown[]) => getPublicWorkerProfile(...args) },
}));

const newcomer: Reputation = {
  average: null,
  fulfillment: null,
  punctuality: null,
  communication: null,
  quality: null,
  ratingsCount: 0,
  completedJobs: 0,
  isNew: true,
  recentComments: [],
};

const rated: Reputation = {
  average: 4.8,
  fulfillment: 4.9,
  punctuality: 4.6,
  communication: 4.8,
  quality: 4.8,
  ratingsCount: 23,
  completedJobs: 23,
  isNew: false,
  recentComments: [{ text: 'Muy puntual <b>y</b> ordenado', date: '2026-11-20T15:00:00.000Z' }],
};

const profile = (overrides: Partial<PublicWorkerProfile> = {}): PublicWorkerProfile => ({
  id: '8fcbfa5e-054b-4c79-a2e4-fabf6fed4703',
  displayName: 'Juan D.',
  photoUrl: 'http://localhost:3001/v1/profiles/worker/8fcb/photo',
  skills: ['Logística', 'Montaje de eventos'],
  experience: 'Dos años en trasteos.',
  zone: { id: 2, name: 'Sur' },
  categories: [{ id: 1, name: 'Trasteos y logística' }],
  availability: 'AVAILABLE',
  reputation: rated,
  ...overrides,
});

beforeEach(() => getPublicWorkerProfile.mockReset());

describe('WorkerPublicProfile', () => {
  it('muestra foto, nombre, disponibilidad, habilidades, experiencia y zona aproximada (HU-029 CA1)', async () => {
    getPublicWorkerProfile.mockResolvedValue(profile());
    render(<WorkerPublicProfile id="x" />);

    expect(await screen.findByRole('heading', { name: 'Juan D.' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Foto de Juan D.' })).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText(/Sur, Cali/)).toBeInTheDocument();
    expect(screen.getByText('Montaje de eventos')).toBeInTheDocument();
    expect(screen.getByText('Dos años en trasteos.')).toBeInTheDocument();
  });

  it('muestra la reputación detallada y los comentarios como texto (HU-029 CA2, HU-046)', async () => {
    getPublicWorkerProfile.mockResolvedValue(profile());
    render(<WorkerPublicProfile id="x" />);

    const summary = await screen.findByText(/promedio de 5/);
    expect(summary.previousElementSibling).toHaveTextContent('4,8');
    expect(screen.getByText(/23 calificaciones · 23 trabajos completados/)).toBeInTheDocument();
    expect(screen.getByText('Puntualidad').nextElementSibling).toHaveTextContent('4,6');
    expect(screen.getByText(/Muy puntual <b>y<\/b> ordenado/)).toBeInTheDocument();
  });

  it('sin calificaciones muestra "Nuevo en la plataforma" (HU-029 CA3)', async () => {
    getPublicWorkerProfile.mockResolvedValue(profile({ reputation: newcomer }));
    render(<WorkerPublicProfile id="x" />);
    expect(await screen.findByText('Nuevo en la plataforma')).toBeInTheDocument();
  });

  it('con foto y experiencia ocultas muestra iniciales y no deja huecos (HU-030 CA4)', async () => {
    getPublicWorkerProfile.mockResolvedValue(profile({ photoUrl: null, experience: null }));
    render(<WorkerPublicProfile id="x" />);

    await screen.findByRole('heading', { name: 'Juan D.' });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /experiencia/i })).not.toBeInTheDocument();
  });

  it('no muestra correo, teléfono ni dirección (HU-029 CA4, HU-030 CA2)', async () => {
    getPublicWorkerProfile.mockResolvedValue(profile());
    const { container } = render(<WorkerPublicProfile id="x" />);
    await screen.findByRole('heading', { name: 'Juan D.' });
    expect(container.textContent).not.toMatch(/@|\b3\d{9}\b/);
  });

  it('distingue un perfil inexistente de un fallo al cargar', async () => {
    getPublicWorkerProfile.mockResolvedValueOnce(null);
    const { unmount } = render(<WorkerPublicProfile id="x" />);
    expect(
      await screen.findByRole('heading', { name: /perfil no encontrado/i }),
    ).toBeInTheDocument();
    unmount();

    getPublicWorkerProfile.mockRejectedValueOnce(new Error('red'));
    render(<WorkerPublicProfile id="x" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos cargar el perfil/i);
  });
});
