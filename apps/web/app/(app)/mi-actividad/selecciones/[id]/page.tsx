import type { Metadata } from 'next';
import { RequireProfile } from '@/components/app/require-profile';
import { SelectionDetail } from '@/components/activity/selection-detail';

export const metadata: Metadata = {
  title: 'Responder a la selección | Red de Oportunidades Laborales Cali',
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireProfile profile="worker">
      <SelectionDetail key={id} id={id} />
    </RequireProfile>
  );
}
