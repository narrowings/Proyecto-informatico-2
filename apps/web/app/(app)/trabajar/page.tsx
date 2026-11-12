import type { Metadata } from 'next';
import { ComingSoon } from '@/components/app/coming-soon';
import { RequireProfile } from '@/components/app/require-profile';

export const metadata: Metadata = {
  title: 'Oportunidades | Red de Oportunidades Laborales Cali',
};

/** "Quiero trabajar". Exige perfil de trabajador (HU-022 CA3). */
export default function TrabajarPage() {
  return (
    <RequireProfile profile="worker">
      <ComingSoon title="Oportunidades para ti">
        Aquí verás el feed de trabajos rápidos y el de empleo formal (HU-004 y HU-009, Sprint 2).
      </ComingSoon>
    </RequireProfile>
  );
}
