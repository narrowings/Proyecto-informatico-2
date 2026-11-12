import type { Metadata } from 'next';
import { ComingSoon } from '@/components/app/coming-soon';
import { RequireProfile } from '@/components/app/require-profile';

export const metadata: Metadata = {
  title: 'Publicar | Red de Oportunidades Laborales Cali',
};

/** "Necesito ayuda". Exige perfil de publicador (HU-022 CA3). */
export default function PublicarPage() {
  return (
    <RequireProfile profile="publisher">
      <ComingSoon title="Publicar una necesidad">
        Aquí podrás crear una oportunidad (HU-003, HU-024 y HU-025).
      </ComingSoon>
    </RequireProfile>
  );
}
