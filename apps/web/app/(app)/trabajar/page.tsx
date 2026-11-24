import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OpportunityFeed } from '@/components/opportunities/opportunity-feed';
import { RequireProfile } from '@/components/app/require-profile';

export const metadata: Metadata = {
  title: 'Oportunidades | Red de Oportunidades Laborales Cali',
};

/** "Quiero trabajar". Exige perfil de trabajador (HU-022 CA3). */
export default function TrabajarPage() {
  return (
    <RequireProfile profile="worker">
      <Suspense fallback={<p>Cargando…</p>}>
        <OpportunityFeed />
      </Suspense>
    </RequireProfile>
  );
}
