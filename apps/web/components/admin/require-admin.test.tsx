import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAdmin } from './require-admin';

const getCurrentUser = vi.fn();
vi.mock('@/lib/api', () => ({ sessionApi: { getCurrentUser: () => getCurrentUser() } }));
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

beforeEach(() => {
  getCurrentUser.mockReset();
  replace.mockReset();
});

describe('HU-012 CA2 Guardia del panel', () => {
  it('sin sesión lleva a iniciar sesión', async () => {
    getCurrentUser.mockResolvedValue(null);
    render(<RequireAdmin>secreto</RequireAdmin>);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/iniciar-sesion'));
    expect(screen.queryByText('secreto')).not.toBeInTheDocument();
  });

  it('un usuario que no es administrador ve el aviso y no el contenido', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u', name: 'Ana', isAdmin: false });
    render(<RequireAdmin>secreto</RequireAdmin>);
    expect(
      await screen.findByText('Esta sección es solo para administradores.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('secreto')).not.toBeInTheDocument();
  });

  it('un administrador ve el contenido', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u', name: 'Ana', isAdmin: true });
    render(<RequireAdmin>secreto</RequireAdmin>);
    expect(await screen.findByText('secreto')).toBeInTheDocument();
  });
});
