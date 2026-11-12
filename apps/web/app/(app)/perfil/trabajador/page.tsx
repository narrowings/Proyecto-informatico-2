import type { Metadata } from 'next';
import { WorkerProfileForm } from '@/components/profiles/worker-profile-form';

export const metadata: Metadata = {
  title: 'Perfil de trabajador | Red de Oportunidades Laborales Cali',
};

/** Perfil de trabajador (HU-002). `?desde=trabajar` llega desde la redirección de HU-022 CA3. */
export default async function PerfilTrabajadorPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string }>;
}) {
  const { desde } = await searchParams;
  return <WorkerProfileForm fromWork={desde === 'trabajar'} />;
}
