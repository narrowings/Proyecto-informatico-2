import type { Metadata } from 'next';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = {
  title: 'Crear cuenta | Red de Oportunidades Laborales Cali',
};

export default function RegistroPage() {
  return <RegisterForm />;
}
