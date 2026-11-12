import Link from 'next/link';
import type { ReactNode } from 'react';

/** Enlace al texto completo de un documento legal; se abre en una pestaña nueva (HU-017). */
export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-bold text-brand underline underline-offset-2"
    >
      {children}
      <span className="sr-only"> (se abre en una pestaña nueva)</span>
    </Link>
  );
}
