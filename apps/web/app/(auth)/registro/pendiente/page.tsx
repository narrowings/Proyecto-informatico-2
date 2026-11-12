import type { Metadata } from 'next';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import { ROUTES } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Confirma tu correo | Red de Oportunidades Laborales Cali',
};

/** Cuenta creada en estado "Pendiente de confirmación" (HU-001 CA1). */
export default function RegistroPendientePage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight font-bold">Confirma tu correo</h1>
        <p className="text-[15px] text-muted">
          Creamos tu cuenta. Te enviamos un correo con un enlace para confirmarla.
        </p>
      </div>

      <Alert tone="info">
        El enlace es válido por 24 horas. Mientras no confirmes tu correo, tu cuenta queda pendiente
        de confirmación y no podrás postularte ni publicar.
      </Alert>

      <ButtonLink href={ROUTES.login} variant="secondary">
        Ir a iniciar sesión
      </ButtonLink>
    </div>
  );
}
