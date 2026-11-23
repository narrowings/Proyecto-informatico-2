import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'Olvidé mi contraseña | Red de Oportunidades Laborales Cali',
};

export default function OlvideContrasenaPage() {
  return <ForgotPasswordForm />;
}
