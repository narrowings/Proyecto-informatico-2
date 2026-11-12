import type { Metadata } from 'next';
import { PublisherProfileForm } from '@/components/profiles/publisher-profile-form';

export const metadata: Metadata = {
  title: 'Perfil de publicador | Red de Oportunidades Laborales Cali',
};

export default function PerfilPublicadorPage() {
  return <PublisherProfileForm />;
}
