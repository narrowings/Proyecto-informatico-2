import type { Metadata } from 'next';
import { AcceptTermsForm } from '@/components/auth/accept-terms-form';

export const metadata: Metadata = {
  title: 'Aceptar nuevos términos | Red de Oportunidades Laborales Cali',
};

export default function AceptarTerminosPage() {
  return <AcceptTermsForm />;
}
