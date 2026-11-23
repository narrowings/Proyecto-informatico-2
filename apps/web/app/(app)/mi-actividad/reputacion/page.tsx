import type { Metadata } from 'next';
import { RequireProfile } from '@/components/app/require-profile';
import { MyReputation } from '@/components/ratings/my-reputation';

export const metadata: Metadata = {
  title: 'Mi reputación | Red de Oportunidades Laborales Cali',
};

/** Mi reputación y calificaciones recibidas (HU-046, HU-013 CA3). */
export default function ReputacionPage() {
  return (
    <RequireProfile profile="none">
      <MyReputation />
    </RequireProfile>
  );
}
