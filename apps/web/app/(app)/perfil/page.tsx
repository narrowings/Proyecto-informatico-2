import type { Metadata } from 'next';
import { MyProfile } from '@/components/profiles/my-profile';

export const metadata: Metadata = {
  title: 'Mi perfil | Red de Oportunidades Laborales Cali',
};

/** Mi perfil: edición, disponibilidad y privacidad (HU-032, HU-030). */
export default function MiPerfilPage() {
  return <MyProfile />;
}
