import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser, LaborWarningRule, ReportGroup } from '@/lib/api/admin';
import { AuditPanel } from './audit-panel';
import { CategoriesPanel, categoryError } from './categories-panel';
import { ReportsPanel } from './reports-panel';
import { RulesPanel, toDisplay, toParams } from './rules-panel';
import { actionsFor, UsersPanel } from './users-panel';

const api = vi.hoisted(() => ({
  reports: vi.fn(),
  reportDetail: vi.fn(),
  users: vi.fn(),
  audit: vi.fn(),
  categories: vi.fn(),
  rules: vi.fn(),
  moderate: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  updateRule: vi.fn(),
}));
vi.mock('@/lib/api', () => ({ adminApi: api }));

const ID = '11111111-1111-4111-8111-111111111111';
const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 20 });
const user = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  id: ID,
  name: 'Beto Pérez',
  email: 'beto@correo.com',
  status: 'ACTIVE',
  role: 'USER',
  createdAt: '2026-11-01T12:00:00Z',
  ...overrides,
});
const group = (overrides: Partial<ReportGroup> = {}): ReportGroup => ({
  targetType: 'OPPORTUNITY',
  targetId: ID,
  reportCount: 2,
  reasons: { FRAUD: 1, SPAM: 1 },
  firstReportedAt: '2026-11-01T12:00:00Z',
  lastReportedAt: '2026-11-02T12:00:00Z',
  target: { id: ID, title: 'Pintar sala', hiddenAt: null },
  ...overrides,
});
const rule = (
  code: LaborWarningRule['code'],
  params: Record<string, unknown>,
): LaborWarningRule => ({
  code,
  message: 'Texto aprobado por jurídica para la advertencia.',
  params,
  isActive: true,
  updatedAt: '2026-11-01T12:00:00Z',
});
const reason = 'Fraude reiterado contra trabajadores';

async function confirmWithReason(buttonName: string) {
  await userEvent.click(await screen.findByRole('button', { name: buttonName }));
  const dialog = screen.getByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText('Motivo'), reason);
  await userEvent.click(within(dialog).getAllByRole('button').at(-1)!);
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
});

describe('HU-012 CA1 Reportes', () => {
  it('muestra el elemento, los motivos y oculta con motivo obligatorio; luego recarga', async () => {
    api.reports.mockResolvedValue(page([group()]));
    api.moderate.mockResolvedValue({ status: 'ok' });
    render(<ReportsPanel />);
    expect(await screen.findByText('Pintar sala')).toBeInTheDocument();
    expect(screen.getByText(/Fraude o estafa \(1\), Spam \(1\)/)).toBeInTheDocument();
    expect(api.reports.mock.calls[0][0].toString()).toBe('status=PENDING&page=1&pageSize=10');
    await confirmWithReason('Ocultar publicación');
    expect(api.moderate).toHaveBeenCalledWith({ kind: 'hide', opportunityId: ID }, reason);
    expect(await screen.findByText('Ocultar publicación: listo.')).toBeInTheDocument();
    expect(api.reports).toHaveBeenCalledTimes(2);
  });

  it('si la API rechaza la acción, el diálogo muestra el motivo y no cierra', async () => {
    api.reports.mockResolvedValue(page([group()]));
    api.moderate.mockResolvedValue({ status: 'already_hidden' });
    render(<ReportsPanel />);
    await confirmWithReason('Ocultar publicación');
    expect(await screen.findByText('La publicación ya estaba oculta.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('un usuario reportado se puede bloquear, pero nunca un administrador', async () => {
    api.reports.mockResolvedValue(
      page([
        group({ targetType: 'USER', target: { name: 'Beto', email: 'b@c.co', status: 'ACTIVE' } }),
        group({
          targetType: 'USER',
          targetId: '22222222-2222-4222-8222-222222222222',
          target: { name: 'Admin', email: 'a@c.co', status: 'ACTIVE', role: 'ADMIN' },
        }),
      ]),
    );
    render(<ReportsPanel />);
    expect(await screen.findAllByRole('button', { name: 'Bloquear' })).toHaveLength(1);
  });

  it('el detalle muestra motivos y descripciones; filtra por estado', async () => {
    api.reports.mockResolvedValue(page([group()]));
    api.reportDetail.mockResolvedValue({
      reports: [
        { reason: 'OTHER', description: 'Pide dinero antes', createdAt: '2026-11-01T12:00:00Z' },
      ],
    });
    render(<ReportsPanel />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ver detalle' }));
    expect(await screen.findByText('Pide dinero antes')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'DISMISSED');
    expect(api.reports.mock.lastCall?.[0].get('status')).toBe('DISMISSED');
  });

  it('con error permite reintentar', async () => {
    api.reports.mockRejectedValueOnce(new Error('red')).mockResolvedValueOnce(page([]));
    render(<ReportsPanel />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('No hay reportes con estos filtros.')).toBeInTheDocument();
  });
});

describe('HU-012 CA3 Usuarios', () => {
  it('las acciones dependen del estado y nunca aplican a administradores', () => {
    expect(actionsFor(user())).toEqual(['suspend', 'block']);
    expect(actionsFor(user({ status: 'SUSPENDED' }))).toEqual(['block', 'reactivate']);
    expect(actionsFor(user({ status: 'BLOCKED' }))).toEqual(['reactivate']);
    expect(actionsFor(user({ status: 'PENDING_CONFIRMATION' }))).toEqual([]);
    expect(actionsFor(user({ role: 'ADMIN' }))).toEqual([]);
  });

  it('busca 300 ms después de escribir y suspende con motivo', async () => {
    api.users.mockResolvedValue(page([user()]));
    api.moderate.mockResolvedValue({ status: 'ok' });
    render(<UsersPanel />);
    expect(await screen.findByText('Beto Pérez')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Buscar por nombre o correo'), 'beto');
    await act(() => new Promise((resolve) => setTimeout(resolve, 350)));
    expect(api.users.mock.lastCall?.[0].get('q')).toBe('beto');
    await confirmWithReason('Suspender');
    expect(api.moderate).toHaveBeenCalledWith({ kind: 'suspend', userId: ID }, reason);
  });
});

describe('HU-037 Categorías', () => {
  it('valida nombre y descripción', () => {
    expect(categoryError('ab', '')).toMatch(/entre 3 y 100/);
    expect(categoryError('Mascotas', 'x'.repeat(301))).toMatch(/300/);
    expect(categoryError('Mascotas', '')).toBeNull();
  });

  it('crea, informa nombre repetido y desactiva', async () => {
    api.categories.mockResolvedValue([
      { id: 3, name: 'Plomería', description: null, isActive: true, opportunities: 4 },
    ]);
    api.createCategory.mockResolvedValue({ status: 'category_exists' });
    api.updateCategory.mockResolvedValue({ status: 'ok' });
    render(<CategoriesPanel />);
    expect(await screen.findByText('4 publicaciones')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nombre'), '  plomería ');
    await userEvent.click(screen.getByRole('button', { name: 'Crear categoría' }));
    expect(api.createCategory).toHaveBeenCalledWith({ name: 'plomería', description: null });
    expect(await screen.findByText('Ya existe una categoría con ese nombre.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(api.updateCategory).toHaveBeenCalledWith(3, { isActive: false });
    expect(await screen.findByText('Categoría desactivada.')).toBeInTheDocument();
  });
});

describe('RF-03-05 Reglas laborales', () => {
  it('convierte horas y días a minutos y valida los rangos', () => {
    expect(toDisplay(rule('FULL_DAY', { minMinutes: 480 }))).toBe('8');
    expect(toDisplay(rule('LONG_TERM', { minMinutes: 43200 }))).toBe('30');
    expect(toParams('FULL_DAY', '7')).toEqual({ params: { minMinutes: 420 } });
    expect(toParams('LONG_TERM', '2')).toEqual({ params: { minMinutes: 2880 } });
    expect(toParams('FULL_DAY', '25')).toHaveProperty('error');
    expect(toParams('LONG_TERM', '1.5')).toHaveProperty('error');
    expect(toParams('SUBORDINATION_TERMS', ' horario fijo \n\n bajo mis órdenes')).toEqual({
      params: { terms: ['horario fijo', 'bajo mis órdenes'] },
    });
    expect(toParams('SUBORDINATION_TERMS', 'x')).toHaveProperty('error');
  });

  it('guarda la regla con los minutos convertidos', async () => {
    api.rules.mockResolvedValue([rule('FULL_DAY', { minMinutes: 480 })]);
    api.updateRule.mockResolvedValue({ status: 'ok' });
    render(<RulesPanel />);
    const hours = await screen.findByLabelText('Desde cuántas horas');
    await userEvent.clear(hours);
    await userEvent.type(hours, '7');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar regla' }));
    expect(api.updateRule).toHaveBeenCalledWith('FULL_DAY', {
      message: 'Texto aprobado por jurídica para la advertencia.',
      isActive: true,
      params: { minMinutes: 420 },
    });
    expect(await screen.findByText('Regla "Jornada completa" guardada.')).toBeInTheDocument();
  });
});

describe('HU-038 Auditoría', () => {
  it('muestra los eventos en español, filtra por tipo y no ofrece editar ni borrar', async () => {
    api.audit.mockResolvedValue(
      page([
        {
          id: 'a1',
          action: 'USER_BLOCKED',
          actorUserId: ID,
          targetType: 'user',
          targetId: 'x',
          reason: 'Fraude',
          ip: '10.0.0.1',
          createdAt: '2026-11-01T12:00:00Z',
        },
      ]),
    );
    render(<AuditPanel />);
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Cuenta bloqueada')).toBeInTheDocument();
    expect(within(table).queryByRole('button')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Tipo de evento'), 'ADMIN_LOGIN');
    expect(api.audit.mock.lastCall?.[0].get('action')).toBe('ADMIN_LOGIN');
  });

  it('un usuario que no es un identificador válido no se envía como filtro', async () => {
    api.audit.mockResolvedValue(page([]));
    render(<AuditPanel />);
    await userEvent.type(screen.getByLabelText('Usuario (identificador)'), 'abc');
    expect(
      await screen.findByText('Pega el identificador completo del usuario.'),
    ).toBeInTheDocument();
    expect(api.audit.mock.lastCall?.[0].has('actorUserId')).toBe(false);
  });
});
