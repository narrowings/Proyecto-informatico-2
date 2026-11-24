import type { Metadata } from 'next';
import { RequireProfile } from '@/components/app/require-profile';
import { JobDetail } from '@/components/activity/job-detail';

export const metadata: Metadata = {
  title: 'Detalle del trabajo | Red de Oportunidades Laborales Cali',
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireProfile profile="none">
      <JobDetail key={id} id={id} />
    </RequireProfile>
  );
}
