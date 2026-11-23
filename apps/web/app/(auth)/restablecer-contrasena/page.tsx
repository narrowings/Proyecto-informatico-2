import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Restablecer contraseña | Red de Oportunidades Laborales Cali',
  // El token viaja en la URL: que no salga en el Referer de enlaces externos.
  referrer: 'no-referrer',
};

/** Destino del enlace del correo de recuperación (`?token=`). La ruta es obligatoria tal cual. */
export default async function RestablecerContrasenaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === 'string' ? token : ''} />;
}
