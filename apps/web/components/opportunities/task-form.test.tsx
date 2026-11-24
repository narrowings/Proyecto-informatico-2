import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/http';
import { ROUTES } from '@/lib/routes';
import { TaskForm } from './task-form';

const replace = vi.fn();
const previewLaborWarnings = vi.fn();
const publish = vi.fn();
const listZones = vi.fn();
const listCategories = vi.fn();
const onPublished = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api', () => ({
  opportunitiesApi: {
    previewLaborWarnings: (...args: unknown[]) => previewLaborWarnings(...args),
    publish: (...args: unknown[]) => publish(...args),
  },
  catalogsApi: {
    listZones: () => listZones(),
    listCategories: () => listCategories(),
  },
}));

const warning = {
  code: 'FULL_DAY',
  message: 'Una jornada de 8 horas o más puede indicar una relación laboral.',
};

const expectedInput = {
  type: 'TASK',
  title: 'Cargar cajas',
  description: 'Necesito ayuda para cargar cajas pesadas en una bodega',
  categoryId: 1,
  zoneId: 2,
  peopleNeeded: 1,
  paymentCop: 70000,
  scheduledAt: '2099-12-01T15:00:00.000Z',
  durationMinutes: 120,
};

beforeEach(() => {
  vi.clearAllMocks();
  listZones.mockResolvedValue([{ id: 2, name: 'Ciudad Jardín' }]);
  listCategories.mockResolvedValue([{ id: 1, name: 'Mudanzas' }]);
  previewLaborWarnings.mockResolvedValue([]);
  publish.mockResolvedValue({ ok: true, id: 'op-1' });
});

async function openForm(type: 'TASK' | 'SERVICE' = 'TASK') {
  const user = userEvent.setup();
  render(<TaskForm type={type} onPublished={onPublished} />);
  await screen.findByLabelText('Actividad');
  return user;
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Actividad'), 'Cargar cajas');
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
}

const submit = (user: ReturnType<typeof userEvent.setup>, name = 'Publicar') =>
  user.click(screen.getByRole('button', { name }));

describe('TaskForm: publicar una necesidad (HU-003)', () => {
  it('publica con los datos completos, la fecha en UTC y sin pedir dirección (CA1)', async () => {
    const user = await openForm();
    await fillValid(user);
    await submit(user);

    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
    expect(previewLaborWarnings).toHaveBeenCalledWith(expectedInput);
    expect(publish).toHaveBeenCalledWith(expectedInput, false);
  });

  it('envía las condiciones solo si se escribieron (CA1)', async () => {
    const user = await openForm();
    await fillValid(user);
    await user.type(screen.getByLabelText('Condiciones (opcional)'), 'Llevar guantes');
    await submit(user);

    await waitFor(() => expect(publish).toHaveBeenCalled());
    expect(publish.mock.calls[0][0]).toMatchObject({ conditions: 'Llevar guantes' });
  });

  it('muestra el pago con formato de pesos mientras se escribe', async () => {
    const user = await openForm();
    await user.type(screen.getByLabelText('Pago ofrecido (COP)'), '150000');
    expect(screen.getByText('Pago: $ 150.000')).toBeInTheDocument();
  });

  it('no publica y marca cada campo obligatorio faltante (CA3)', async () => {
    const user = await openForm();
    await submit(user);

    expect(await screen.findByText('Escribe la actividad que necesitas.')).toBeInTheDocument();
    expect(screen.getByText('Elige una categoría.')).toBeInTheDocument();
    expect(screen.getByText('Describe lo que necesitas.')).toBeInTheDocument();
    expect(screen.getByText('Indica el pago ofrecido.')).toBeInTheDocument();
    expect(screen.getByText('Indica la fecha y la hora.')).toBeInTheDocument();
    expect(screen.getByText('Indica la duración.')).toBeInTheDocument();
    expect(screen.getByText('Elige la zona de Cali.')).toBeInTheDocument();
    expect(screen.getByLabelText('Actividad')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Actividad')).toHaveFocus();
    expect(previewLaborWarnings).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('solo pide la zona, nunca la dirección exacta (CA4)', async () => {
    await openForm();
    expect(screen.queryByLabelText(/dirección/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Zona de Cali')).toBeInTheDocument();
    expect(screen.getByText(/la dirección exacta se pide después/i)).toBeInTheDocument();
  });

  it('con advertencia laboral la muestra tal cual y no publica todavía (CA2)', async () => {
    previewLaborWarnings.mockResolvedValue([warning]);
    const user = await openForm();
    await fillValid(user);
    await submit(user);

    expect(await screen.findByText(warning.message)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/posible relación laboral/i);
    expect(publish).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirmar y publicar' })).toBeInTheDocument();
  });

  it('exige marcar "Leí la advertencia" antes de publicar (CA2)', async () => {
    previewLaborWarnings.mockResolvedValue([warning]);
    const user = await openForm();
    await fillValid(user);
    await submit(user);
    await screen.findByText(warning.message);

    await submit(user, 'Confirmar y publicar');
    expect(
      await screen.findByText('Confirma que leíste la advertencia para poder publicar.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Leí la advertencia sobre relación laboral')).toHaveFocus();
    expect(publish).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText('Leí la advertencia sobre relación laboral'));
    await submit(user, 'Confirmar y publicar');

    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
    expect(publish).toHaveBeenCalledWith(expectedInput, true);
    expect(previewLaborWarnings).toHaveBeenCalledTimes(1);
  });

  it('si se edita algo tras ver la advertencia, se vuelve a consultar', async () => {
    previewLaborWarnings.mockResolvedValue([warning]);
    const user = await openForm();
    await fillValid(user);
    await submit(user);
    await screen.findByText(warning.message);

    await user.type(screen.getByLabelText('Condiciones (opcional)'), 'Sin horario fijo');
    expect(screen.queryByText(warning.message)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
  });

  it('si el API exige la advertencia al publicar, la muestra y pide confirmarla (CA2)', async () => {
    publish.mockResolvedValueOnce({
      ok: false,
      reason: 'labor_warning_required',
      warnings: [warning],
    });
    const user = await openForm();
    await fillValid(user);
    await submit(user);

    expect(await screen.findByText(warning.message)).toBeInTheDocument();
    expect(onPublished).not.toHaveBeenCalled();
  });

  it('muestra cada error por campo que devuelve el API', async () => {
    publish.mockRejectedValue(
      new ApiError(
        400,
        {
          message: 'Revisa los campos marcados',
          errors: {
            paymentCop: ['El valor es demasiado alto'],
            zoneId: ['Elige una zona de Cali de la lista'],
          },
        },
        Number.NaN,
      ),
    );
    const user = await openForm();
    await fillValid(user);
    await submit(user);

    expect(await screen.findByText('El valor es demasiado alto')).toBeInTheDocument();
    expect(screen.getByText('Elige una zona de Cali de la lista')).toBeInTheDocument();
    expect(screen.getByLabelText('Pago ofrecido (COP)')).toHaveAttribute('aria-invalid', 'true');
    expect(onPublished).not.toHaveBeenCalled();
  });

  it('con el correo sin confirmar lo indica', async () => {
    publish.mockRejectedValue(
      new ApiError(403, { code: 'EMAIL_NOT_CONFIRMED', message: 'x' }, Number.NaN),
    );
    const user = await openForm();
    await fillValid(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/confirmar tu correo/i);
  });

  it('sin perfil de publicador lleva a crearlo', async () => {
    publish.mockRejectedValue(
      new ApiError(403, { code: 'PUBLISHER_PROFILE_REQUIRED', message: 'x' }, Number.NaN),
    );
    const user = await openForm();
    await fillValid(user);
    await submit(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(ROUTES.publisherProfile));
  });

  it('sin sesión lleva a iniciar sesión', async () => {
    publish.mockRejectedValue(new ApiError(401, {}, Number.NaN));
    const user = await openForm();
    await fillValid(user);
    await submit(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(ROUTES.login));
  });

  it('con demasiadas publicaciones indica cuánto esperar (429)', async () => {
    publish.mockRejectedValue(new ApiError(429, { message: 'x' }, 600));
    const user = await openForm();
    await fillValid(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Inténtalo de nuevo en 10 minutos.');
  });

  it('ante un error inesperado muestra un mensaje y no publica', async () => {
    publish.mockRejectedValue(new Error('boom'));
    const user = await openForm();
    await fillValid(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos publicar/i);
    expect(onPublished).not.toHaveBeenCalled();
  });

  it('si no cargan los catálogos permite reintentar', async () => {
    listZones.mockRejectedValueOnce(new Error('sin red'));
    const user = userEvent.setup();
    render(<TaskForm type="TASK" onPublished={onPublished} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos cargar/i);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByLabelText('Actividad')).toBeInTheDocument();
  });
});
