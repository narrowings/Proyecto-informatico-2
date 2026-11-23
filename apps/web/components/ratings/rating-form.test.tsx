import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RatingForm } from './rating-form';

const rateJob = vi.fn();
vi.mock('@/lib/api', () => ({
  ratingsApi: { rateJob: (...args: unknown[]) => rateJob(...args) },
}));

const JOB = '8fcbfa5e-054b-4c79-a2e4-fabf6fed4703';
const submit = () => screen.getByRole('button', { name: /enviar calificación/i });

async function rate(user: ReturnType<typeof userEvent.setup>, stars: Record<string, number>) {
  for (const [dimension, value] of Object.entries(stars)) {
    const group = screen.getByRole('group', { name: dimension });
    await user.click(
      within(group).getByLabelText(value === 1 ? '1 estrella' : `${value} estrellas`),
    );
  }
}

const allFive = { Cumplimiento: 5, Puntualidad: 4, Comunicación: 5, Calidad: 3 };

beforeEach(() => rateJob.mockReset());

describe('RatingForm', () => {
  it('envía las cuatro dimensiones y el comentario (HU-007 CA1)', async () => {
    rateJob.mockResolvedValue({ status: 'rated', published: false });
    const user = userEvent.setup();
    render(<RatingForm jobId={JOB} counterpartyName="Marcela R." />);

    expect(screen.getByRole('heading', { name: 'Califica a Marcela R.' })).toBeInTheDocument();
    await rate(user, allFive);
    await user.type(screen.getByLabelText(/comentario/i), '  Muy puntual  ');
    await user.click(submit());

    expect(rateJob).toHaveBeenCalledWith(JOB, {
      fulfillment: 5,
      punctuality: 4,
      communication: 5,
      quality: 3,
      comment: 'Muy puntual',
    });
    // CA2: queda oculta hasta que califique la otra parte o pasen 7 días.
    expect(await screen.findByRole('status')).toHaveTextContent(/oculta hasta que la otra parte/);
  });

  it('si ambas partes ya calificaron, avisa que ya son visibles (HU-007 CA2)', async () => {
    rateJob.mockResolvedValue({ status: 'rated', published: true });
    const user = userEvent.setup();
    render(<RatingForm jobId={JOB} />);
    await rate(user, allFive);
    await user.click(submit());
    expect(await screen.findByRole('status')).toHaveTextContent(/ya son visibles/);
  });

  it('sin comentario no lo envía', async () => {
    rateJob.mockResolvedValue({ status: 'rated', published: false });
    const user = userEvent.setup();
    render(<RatingForm jobId={JOB} />);
    await rate(user, allFive);
    await user.click(submit());
    expect(rateJob.mock.calls[0][1]).not.toHaveProperty('comment');
  });

  it('exige elegir estrellas en las cuatro dimensiones', async () => {
    const user = userEvent.setup();
    render(<RatingForm jobId={JOB} />);
    await rate(user, { Cumplimiento: 5 });
    await user.click(submit());

    expect(await screen.findByText('Elige de 1 a 5 estrellas en puntualidad.')).toBeInTheDocument();
    expect(screen.getByText('Elige de 1 a 5 estrellas en calidad.')).toBeInTheDocument();
    expect(rateJob).not.toHaveBeenCalled();
  });

  it('no permite calificar dos veces (HU-007 CA4)', async () => {
    rateJob.mockResolvedValue({ status: 'already_rated' });
    const user = userEvent.setup();
    render(<RatingForm jobId={JOB} />);
    await rate(user, allFive);
    await user.click(submit());

    expect(
      await screen.findByRole('heading', { name: /ya calificaste este trabajo/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/no se puede editar/);
  });

  it('explica que solo se califica un trabajo completado', async () => {
    rateJob.mockResolvedValue({ status: 'not_completed' });
    const user = userEvent.setup();
    render(<RatingForm jobId={JOB} />);
    await rate(user, allFive);
    await user.click(submit());
    expect(
      await screen.findByRole('heading', { name: /aún no puedes calificar/i }),
    ).toBeInTheDocument();
  });

  it('las estrellas son un grupo de radios usable con teclado', async () => {
    const user = userEvent.setup();
    render(<RatingForm jobId={JOB} />);
    const group = screen.getByRole('group', { name: 'Calidad' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(5);

    await user.click(radios[1]);
    await user.keyboard('{ArrowRight}');
    expect(within(group).getByLabelText('3 estrellas')).toBeChecked();
  });
});
