import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportButton } from './report-button';

const create = vi.fn();
vi.mock('@/lib/api', () => ({ reportsApi: { create: (...args: unknown[]) => create(...args) } }));

const ID = '6f1c1f5e-3a1b-4b5e-9d0e-1c2b3a4d5e6f';
const open = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Reportar' }));
  return screen.getByRole('dialog');
};

beforeEach(() => create.mockReset());

describe('HU-019 Botón Reportar', () => {
  it('CA1/CA2: envía el motivo, agradece, deja de ofrecer el envío y avisa al padre', async () => {
    create.mockResolvedValue({ status: 'reported', message: 'Gracias por tu reporte.' });
    const onReported = vi.fn();
    render(
      <ReportButton targetType="USER" targetId={ID} profileKind="WORKER" onReported={onReported} />,
    );
    await open();
    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'SPAM');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(create).toHaveBeenCalledWith({
      targetType: 'USER',
      targetId: ID,
      profileKind: 'WORKER',
      reason: 'SPAM',
    });
    expect(await screen.findByText('Gracias por tu reporte.')).toBeInTheDocument();
    expect(onReported).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Enviar reporte' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });

  it('CA3: con "Otro" exige al menos 10 caracteres antes de enviar', async () => {
    create.mockResolvedValue({ status: 'reported', message: 'Gracias' });
    render(<ReportButton targetType="OPPORTUNITY" targetId={ID} />);
    await open();
    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'OTHER');
    await userEvent.type(screen.getByLabelText('Descripción'), 'corto');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(await screen.findByText(/al menos 10 caracteres/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Descripción'), ' pero ahora sí');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'OTHER', description: 'corto pero ahora sí' }),
    );
  });

  it.each([
    ['already_reported', 'Ya reportaste este elemento.'],
    ['cannot_report_self', 'No puedes reportarte a ti mismo.'],
    ['rate_limited', /demasiados reportes/],
    ['not_found', 'Este elemento ya no está disponible.'],
  ])('CA4 y errores: %s', async (status, text) => {
    create.mockResolvedValue({ status });
    render(<ReportButton targetType="OPPORTUNITY" targetId={ID} />);
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar reporte' })).toBeInTheDocument();
  });

  it('Esc cierra el diálogo y devuelve el foco al botón', async () => {
    render(<ReportButton targetType="OPPORTUNITY" targetId={ID} />);
    await open();
    expect(screen.getByLabelText('Motivo')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Reportar' })).toHaveFocus());
  });
});
