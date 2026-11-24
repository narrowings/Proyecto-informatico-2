import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Opportunity } from '@/lib/api/opportunities';
import { OpportunityDetail } from './opportunity-detail';

const get = vi.fn();
const apply = vi.fn();
const applicationStatus = vi.fn();
const getCurrentUser = vi.fn();
vi.mock('@/lib/api', () => ({
  opportunitiesApi: {
    get: (...args: unknown[]) => get(...args),
    apply: (...args: unknown[]) => apply(...args),
    applicationStatus: (...args: unknown[]) => applicationStatus(...args),
  },
  sessionApi: { getCurrentUser: () => getCurrentUser() },
  reportsApi: { create: vi.fn() },
}));
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const ID = '11111111-1111-4111-8111-111111111111';
const task = (overrides: Partial<Opportunity> = {}): Opportunity => ({
  id: ID,
  type: 'TASK',
  status: 'ACTIVE',
  title: 'Pintar sala comedor',
  description: 'Pintar sala y comedor de un apartamento.',
  category: { id: 1, name: 'Hogar' },
  zone: { id: 2, name: 'Sur' },
  paymentCop: 150000,
  salaryMinCop: null,
  salaryMaxCop: null,
  modality: null,
  schedule: null,
  scheduledAt: '2099-01-01T15:00:00.000Z',
  closesAt: null,
  publisher: { id: 'p1', displayName: 'Carla', photoUrl: null },
  peopleNeeded: 2,
  durationMinutes: 240,
  conditions: null,
  ...overrides,
});

beforeEach(() => {
  for (const fn of [get, apply, applicationStatus, getCurrentUser, push]) fn.mockReset();
  applicationStatus.mockResolvedValue({});
  getCurrentUser.mockResolvedValue({ id: 'u', name: 'Ana', publisherProfileId: 'otro' });
});

describe('HU-026 y HU-005 Detalle y postulación', () => {
  it('muestra los datos públicos y con "Me interesa" se postula sin mensaje', async () => {
    get.mockResolvedValue({ status: 'found', opportunity: task() });
    apply.mockResolvedValue({ status: 'applied' });
    render(<OpportunityDetail id={ID} />);
    expect(await screen.findByRole('heading', { name: 'Pintar sala comedor' })).toBeInTheDocument();
    expect(screen.getByText('4 h')).toBeInTheDocument();
    expect(screen.getByText(/dirección exacta solo se comparte/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Me interesa' }));
    expect(apply).toHaveBeenCalledWith(ID, undefined);
    expect(
      await screen.findByText('Listo, el publicador verá que te interesa.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Me interesa' })).not.toBeInTheDocument();
  });

  it('en una vacante formal envía el mensaje opcional', async () => {
    get.mockResolvedValue({
      status: 'found',
      opportunity: task({
        type: 'FORMAL_JOB',
        paymentCop: null,
        salaryMinCop: 1600000,
        salaryMaxCop: 2000000,
        modality: 'REMOTE',
        schedule: 'FULL_TIME',
        closesAt: '2099-01-01T15:00:00.000Z',
      }),
    });
    apply.mockResolvedValue({ status: 'applied' });
    render(<OpportunityDetail id={ID} />);
    await userEvent.type(
      await screen.findByLabelText('Mensaje para la empresa (opcional)'),
      ' Tengo experiencia ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Postularme' }));
    expect(apply).toHaveBeenCalledWith(ID, 'Tengo experiencia');
    expect(screen.getByText('Remota')).toBeInTheDocument();
  });

  it.each([
    ['closed', 'Esta oportunidad ya no recibe postulaciones.'],
    ['email_not_confirmed', 'Confirma tu correo antes de postularte.'],
    ['rate_limited', /demasiados intentos/],
  ])('muestra el motivo cuando la API responde %s', async (status, text) => {
    get.mockResolvedValue({ status: 'found', opportunity: task() });
    apply.mockResolvedValue({ status });
    render(<OpportunityDetail id={ID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Me interesa' }));
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('sin perfil de trabajador lleva a crearlo', async () => {
    get.mockResolvedValue({ status: 'found', opportunity: task() });
    apply.mockResolvedValue({ status: 'no_worker_profile' });
    render(<OpportunityDetail id={ID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Me interesa' }));
    expect(push).toHaveBeenCalledWith('/perfil/trabajador');
  });

  it('si ya se postuló no ofrece el botón', async () => {
    get.mockResolvedValue({ status: 'found', opportunity: task() });
    applicationStatus.mockResolvedValue({ [ID]: 'RECEIVED' });
    render(<OpportunityDetail id={ID} />);
    expect(await screen.findByText('Ya te postulaste a esta oportunidad.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Me interesa' })).not.toBeInTheDocument();
  });

  it('el dueño ve el enlace a Mi actividad, sin postularse ni reportar', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u', name: 'Carla', publisherProfileId: 'p1' });
    get.mockResolvedValue({ status: 'found', opportunity: task() });
    render(<OpportunityDetail id={ID} />);
    expect(await screen.findByText('Es tu publicación: verla en Mi actividad')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Me interesa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reportar' })).not.toBeInTheDocument();
  });

  it('una oportunidad inexistente o cerrada lo dice; con error permite reintentar', async () => {
    get.mockResolvedValueOnce({ status: 'not_found' });
    const { unmount } = render(<OpportunityDetail id={ID} />);
    expect(await screen.findByText('Esta oportunidad ya no está disponible.')).toBeInTheDocument();
    unmount();

    get.mockResolvedValueOnce({ status: 'found', opportunity: task({ status: 'CLOSED' }) });
    const closed = render(<OpportunityDetail id={ID} />);
    expect(await screen.findByText('Esta oportunidad está cerrada.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Me interesa' })).not.toBeInTheDocument();
    closed.unmount();

    get
      .mockRejectedValueOnce(new Error('red'))
      .mockResolvedValueOnce({ status: 'found', opportunity: task() });
    render(<OpportunityDetail id={ID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Pintar sala comedor' })).toBeInTheDocument();
  });
});
