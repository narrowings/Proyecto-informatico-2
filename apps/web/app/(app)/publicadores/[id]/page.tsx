import type { Metadata } from 'next';
import { PublisherPublicProfile } from '@/components/profiles/publisher-public-profile';

export const metadata: Metadata = {
  title: 'Publicador | Red de Oportunidades Laborales Cali',
};

export default async function PublicadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublisherPublicProfile id={id} />;
}
