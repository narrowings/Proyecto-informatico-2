import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ConfirmEmail } from '@/components/auth/confirm-email';

export const metadata: Metadata = {
  title: 'Confirmar correo | Red de Oportunidades Laborales Cali',
};

export default function ConfirmarCorreoPage() {
  return (
    <Suspense>
      <ConfirmEmail />
    </Suspense>
  );
}
