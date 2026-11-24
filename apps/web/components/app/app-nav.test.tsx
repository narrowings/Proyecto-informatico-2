import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@/lib/routes';
import { AppNav } from './app-nav';

let pathname = ROUTES.work as string;
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
const getCurrentUser = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/api', () => ({ sessionApi: { getCurrentUser: () => getCurrentUser() } }));

describe('AppNav', () => {
  it('permite cambiar de intención desde el menú principal (HU-022 CA4)', () => {
    render(<AppNav />);
    const nav = screen.getByRole('navigation', { name: /menú principal/i });

    expect(nav).toContainElement(screen.getByRole('link', { name: 'Explorar' }));
    expect(screen.getByRole('link', { name: 'Explorar' })).toHaveAttribute('href', ROUTES.work);
    expect(screen.getByRole('link', { name: 'Publicar' })).toHaveAttribute('href', ROUTES.publish);
    expect(screen.getByRole('link', { name: 'Actividad' })).toHaveAttribute(
      'href',
      ROUTES.activity,
    );
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', ROUTES.myProfile);
  });

  it('marca la sección actual', () => {
    pathname = ROUTES.publish;
    render(<AppNav />);
    expect(screen.getByRole('link', { name: 'Publicar' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Explorar' })).not.toHaveAttribute('aria-current');
  });

  it('HU-012: el acceso a Administración solo aparece para administradores', async () => {
    getCurrentUser.mockResolvedValueOnce({ id: 'u', name: 'Ana', isAdmin: false });
    const { unmount } = render(<AppNav />);
    await screen.findByRole('link', { name: 'Explorar' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    unmount();
    getCurrentUser.mockResolvedValueOnce({ id: 'u', name: 'Ana', isAdmin: true });
    render(<AppNav />);
    expect(await screen.findByRole('link', { name: 'Admin' })).toHaveAttribute(
      'href',
      ROUTES.admin,
    );
  });
});
