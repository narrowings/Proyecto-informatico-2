import type { Metadata } from 'next';
import { RequireProfile } from '@/components/app/require-profile';
import { PublishFlow } from '@/components/opportunities/publish-flow';

export const metadata: Metadata = {
  title: 'Publicar | Red de Oportunidades Laborales Cali',
};

/** "Necesito ayuda". Exige perfil de publicador (HU-022 CA3). */
export default function PublicarPage() {
  return (
    <RequireProfile profile="publisher">
      <PublishFlow />
    </RequireProfile>
  );
}
