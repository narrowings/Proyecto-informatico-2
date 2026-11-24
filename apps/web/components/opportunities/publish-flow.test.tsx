import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OPPORTUNITY_TYPES } from '@/lib/opportunities/types';
import { ROUTES } from '@/lib/routes';
import { PublishFlow } from './publish-flow';

const previewLaborWarnings = vi.fn();
const publish = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/lib/api', () => ({
  opportunitiesApi: {
    previewLaborWarnings: (...args: unknown[]) => previewLaborWarnings(...args),
    publish: (...args: unknown[]) => publish(...args),
  },
  catalogsApi: {
    listZones: () => Promise.resolve([{ id: 2, name: 'Ciudad Jardín' }]),
    listCategories: () => Promise.resolve([{ id: 1, name: 'Mudanzas' }]),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  previewLaborWarnings.mockResolvedValue([]);
  publish.mockResolvedValue({ ok: true, id: 'op-1' });
});

const choose = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole('radio', { name }));

async function fillAndPublish(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Actividad'), 'Cargar cajas');
  await user.selectOptions(screen.getByLabelText('Categoría'), '1');
  await user.type(
    screen.getByLabelText('Descripción'),
    'Necesito ayuda para cargar cajas pesadas en una bodega',
  );
  await user.type(screen.getByLabelText('Pago ofrecido (COP)'), '70000');
  fireEvent.change(screen.getByLabelText('Fecha y hora'), {
    target: { value: '2099-12-01T10:00' },
  });
  await user.type(screen.getByLabelText('Duración'), '2');
  await user.selectOptions(screen.getByLabelText('Zona de Cali'), '2');
  await user.click(screen.getByRole('button', { name: 'Publicar' }));
}

describe('PublishFlow: selección del tipo de oportunidad (HU-025)', () => {
  it('ofrece los cinco tipos, cada uno con su breve explicación (CA2)', () => {
    render(<PublishFlow />);

    for (const type of OPPORTUNITY_TYPES) {
      const radio = screen.getByRole('radio', { name: type.label });
      expect(radio).toHaveAccessibleDescription(type.description);
    }
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('no deja continuar sin elegir un tipo', async () => {
    const user = userEvent.setup();
    render(<PublishFlow />);

    const next = screen.getByRole('button', { name: 'Continuar' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Elige un tipo para continuar.')).toBeInTheDocument();
    await user.click(next);
    expect(screen.queryByLabelText('Actividad')).not.toBeInTheDocument();
  });

  it('al elegir un tipo muestra el formulario correspondiente (CA1)', async () => {
    const user = userEvent.setup();
    render(<PublishFlow />);
    await choose(user, 'Trabajo rápido');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(
      await screen.findByRole('heading', { name: 'Cuéntanos qué necesitas' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Trabajo rápido', { selector: 'strong' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Actividad')).toBeInTheDocument();
  });

  it('publica con el tipo elegido', async () => {
    const user = userEvent.setup();
    render(<PublishFlow />);
    await choose(user, 'Proyecto');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await fillAndPublish(user);

    await waitFor(() => expect(publish).toHaveBeenCalled());
    expect(publish.mock.calls[0][0]).toMatchObject({ type: 'PROJECT' });
  });

  it('permite cambiar el tipo después de elegirlo', async () => {
    const user = userEvent.setup();
    render(<PublishFlow />);
    await choose(user, 'Tarea');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(await screen.findByRole('button', { name: 'Cambiar tipo' }));

    expect(screen.getByRole('heading', { name: 'Publicar una necesidad' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tarea' })).toBeChecked();
  });

  it('el empleo formal no abre este formulario: avisa que tiene el suyo', async () => {
    const user = userEvent.setup();
    render(<PublishFlow />);
    await choose(user, 'Empleo formal');

    expect(screen.getByRole('status')).toHaveTextContent(/propio formulario/i);
    const next = screen.getByRole('button', { name: 'Continuar' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    await user.click(next);
    expect(screen.queryByLabelText('Actividad')).not.toBeInTheDocument();
  });

  it('con "Servicio" y condiciones de relación laboral recomienda revisar el tipo (CA3)', async () => {
    previewLaborWarnings.mockResolvedValue([
      { code: 'SUBORDINATION_TERMS', message: 'Estas condiciones pueden indicar subordinación.' },
    ]);
    const user = userEvent.setup();
    render(<PublishFlow />);
    await choose(user, 'Servicio');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await fillAndPublish(user);

    expect(
      await screen.findByText('Estas condiciones pueden indicar subordinación.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/revisa el tipo elegido/i)).toBeInTheDocument();
  });

  it('con "Tarea" la advertencia no sugiere cambiar el tipo', async () => {
    previewLaborWarnings.mockResolvedValue([
      { code: 'FULL_DAY', message: 'Una jornada larga puede indicar relación laboral.' },
    ]);
    const user = userEvent.setup();
    render(<PublishFlow />);
    await choose(user, 'Tarea');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await fillAndPublish(user);

    expect(
      await screen.findByText('Una jornada larga puede indicar relación laboral.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/revisa el tipo elegido/i)).not.toBeInTheDocument();
  });

  it('tras publicar confirma y enlaza a Mi actividad', async () => {
    const user = userEvent.setup();
    render(<PublishFlow />);
    await choose(user, 'Tarea');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await fillAndPublish(user);

    expect(
      await screen.findByRole('heading', { name: '¡Tu oportunidad ya está publicada!' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mi actividad' })).toHaveAttribute(
      'href',
      ROUTES.activity,
    );

    await user.click(screen.getByRole('button', { name: 'Publicar otra' }));
    expect(screen.getByRole('heading', { name: 'Publicar una necesidad' })).toBeInTheDocument();
  });
});
