'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ROUTES } from '@/lib/routes';

const icon = (path: ReactNode) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {path}
  </svg>
);

const ITEMS = [
  {
    href: ROUTES.work,
    label: 'Explorar',
    icon: icon(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8.5l-2 5-5 2 2-5z" />
      </>,
    ),
  },
  {
    href: ROUTES.publish,
    label: 'Publicar',
    icon: icon(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </>,
    ),
  },
  {
    href: ROUTES.activity,
    label: 'Actividad',
    icon: icon(<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />),
  },
];

/**
 * Menú principal (HU-022 CA4): permite cambiar de intención en cualquier
 * momento. Explorar = "Quiero trabajar", Publicar = "Necesito ayuda".
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Menú principal" className="sticky bottom-0 border-t border-line bg-white">
      <ul className="mx-auto flex h-17 max-w-md">
        {ITEMS.map((item) => {
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-brand ${
                  current ? 'font-bold text-brand' : 'font-medium text-muted'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
