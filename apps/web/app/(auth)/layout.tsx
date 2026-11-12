import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';

/**
 * Marco de las pantallas de autenticación. En celular el contenido va directo
 * sobre el fondo (como en el diseño); desde `sm` se centra en una tarjeta.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-5 py-8 sm:py-14">
      <header className="w-full max-w-md">
        <Logo />
      </header>
      <main className="mt-8 w-full max-w-md sm:rounded-card sm:border sm:border-line sm:bg-white sm:p-8">
        {children}
      </main>
    </div>
  );
}
