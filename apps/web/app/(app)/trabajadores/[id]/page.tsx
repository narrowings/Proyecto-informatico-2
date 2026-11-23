import type { Metadata } from 'next';
import { WorkerPublicProfile } from '@/components/profiles/worker-public-profile';

export const metadata: Metadata = {
  title: 'Trabajador | Red de Oportunidades Laborales Cali',
};

/** Perfil público del trabajador (HU-029). Se puede ver sin sesión. */
export default async function TrabajadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkerPublicProfile id={id} />;
}
