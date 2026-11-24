import type { Metadata } from 'next';
import { ActivityDashboard } from '@/components/activity/activity-dashboard';
import { RequireProfile } from '@/components/app/require-profile';

export const metadata: Metadata = {
  title: 'Mi actividad | Red de Oportunidades Laborales Cali',
};

/** "Mi actividad". Solo exige sesión: aplica a trabajadores y publicadores. */
export default function MiActividadPage() {
  return (
    <RequireProfile profile="none">
      <ActivityDashboard />
    </RequireProfile>
  );
}
