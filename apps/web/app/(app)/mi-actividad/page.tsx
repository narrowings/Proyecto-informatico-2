import type { Metadata } from 'next';
import { ComingSoon } from '@/components/app/coming-soon';
import { RequireProfile } from '@/components/app/require-profile';

export const metadata: Metadata = {
  title: 'Mi actividad | Red de Oportunidades Laborales Cali',
};

/** "Mi actividad". Solo exige sesión: aplica a trabajadores y publicadores. */
export default function MiActividadPage() {
  return (
    <RequireProfile profile="none">
      <ComingSoon title="Mi actividad">
        Aquí verás tus postulaciones, publicaciones, acuerdos y reputación (HU-013).
      </ComingSoon>
    </RequireProfile>
  );
}
