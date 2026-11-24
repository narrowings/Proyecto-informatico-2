import type { Metadata } from 'next';
import { RequireProfile } from '@/components/app/require-profile';
import { PublicationDetail } from '@/components/activity/publication-detail';

export const metadata: Metadata = {
  title: 'Gestionar publicación | Red de Oportunidades Laborales Cali',
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireProfile profile="publisher">
      <PublicationDetail key={id} id={id} />
    </RequireProfile>
  );
}
