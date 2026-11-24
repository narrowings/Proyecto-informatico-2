import type { Metadata } from 'next';
import { RequireProfile } from '@/components/app/require-profile';
import { RatingForm } from '@/components/ratings/rating-form';

export const metadata: Metadata = {
  title: 'Calificar | Red de Oportunidades Laborales Cali',
};

/** Calificar a la contraparte de un trabajo completado (HU-007). */
export default async function CalificarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireProfile profile="none">
      <RatingForm jobId={id} />
    </RequireProfile>
  );
}
