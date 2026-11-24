import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Logo } from '@/components/logo';
import { LEGAL_DOCUMENTS, type LegalSlug } from '@/lib/legal/documents';
import { LegalDocument } from '@/lib/legal/markdown';
import { ROUTES } from '@/lib/routes';

type Params = { params: Promise<{ documento: string }> };

// Las cuatro páginas se generan al construir: no dependen de la API ni de la sesión.
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(LEGAL_DOCUMENTS).map((documento) => ({ documento }));
}

const isLegalSlug = (value: string): value is LegalSlug => value in LEGAL_DOCUMENTS;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { documento } = await params;
  return isLegalSlug(documento)
    ? { title: `${LEGAL_DOCUMENTS[documento].title} | Red de Oportunidades Laborales Cali` }
    : {};
}

/** HU-017: texto completo de cada documento legal, público y legible en celular. */
export default async function LegalPage({ params }: Params) {
  const { documento } = await params;
  if (!isLegalSlug(documento)) notFound();
  const markdown = await readFile(
    path.join(process.cwd(), 'content', 'legal', LEGAL_DOCUMENTS[documento].file),
    'utf8',
  );
  return (
    <div className="flex min-h-dvh flex-col items-center px-5 py-8">
      <header className="flex w-full max-w-2xl items-center justify-between gap-3">
        <Link href={ROUTES.home} aria-label="Ir al inicio">
          <Logo />
        </Link>
      </header>
      <main className="mt-8 w-full max-w-2xl rounded-card border border-line bg-white p-5 sm:p-8">
        <LegalDocument markdown={markdown} />
      </main>
    </div>
  );
}
