import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';
import { SESSION_EXPIRED_REASON } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Iniciar sesión | Red de Oportunidades Laborales Cali',
};

export default async function IniciarSesionPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  return <LoginForm sessionExpired={motivo === SESSION_EXPIRED_REASON} />;
}
