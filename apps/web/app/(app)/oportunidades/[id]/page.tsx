import type { Metadata } from 'next';
import { RequireProfile } from '@/components/app/require-profile';
import { OpportunityDetail } from '@/components/opportunities/opportunity-detail';

export const metadata: Metadata = {
  title: 'Oportunidad | Red de Oportunidades Laborales Cali',
};

/** HU-026: detalle de una oportunidad. Postularse exige perfil de trabajador (lo valida la API). */
export default async function OportunidadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireProfile profile="none">
      <OpportunityDetail id={id} />
    </RequireProfile>
  );
}
