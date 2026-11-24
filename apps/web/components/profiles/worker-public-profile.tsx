'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { ReportButton } from '@/components/reports/report-button';
import { profilesApi, type PublicWorkerProfile } from '@/lib/api';
import { useCurrentUser } from '@/lib/session/use-current-user';
import { Avatar } from './avatar';
import { ReputationSummary } from './reputation-summary';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; profile: PublicWorkerProfile | null };

export function AvailabilityBadge({
  availability,
}: {
  availability: PublicWorkerProfile['availability'];
}) {
  const available = availability === 'AVAILABLE';
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px] font-bold ${
        available ? 'text-brand-dark' : 'text-muted'
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-2.5 rounded-full ${available ? 'bg-brand' : 'bg-[#a6b4ae]'}`}
      />
      {available ? 'Disponible' : 'No disponible'}
    </span>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5 text-[13px] font-medium">
      {items.map((item) => (
        <li key={item} className="rounded-full bg-[#eef3f1] px-3 py-1.5 break-words">
          {item}
        </li>
      ))}
    </ul>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-white p-4">
      <h2 className="text-xs font-bold tracking-widest text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Perfil público del trabajador (HU-029 CA1–CA4, HU-030 CA1–CA2). Muestra solo
 * lo que el API entrega en su lista blanca: nunca correo, teléfono, dirección
 * exacta ni documentos, y respeta la foto y la experiencia ocultas.
 */
export function WorkerPublicProfile({ id }: { id: string }) {
  const session = useCurrentUser();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    profilesApi
      .getPublicWorkerProfile(id)
      .then((profile) => {
        if (active) setState({ status: 'ready', profile });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (state.status === 'loading') {
    return (
      <p role="status" className="text-[15px] text-muted">
        Cargando perfil…
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <Alert tone="danger" role="alert">
        No pudimos cargar el perfil. Inténtalo de nuevo.
      </Alert>
    );
  }
  const { profile } = state;
  if (!profile) {
    return <h1 className="font-display text-3xl font-bold">Perfil no encontrado</h1>;
  }

  return (
    <article className="flex flex-col gap-3.5">
      <header className="flex items-center gap-3.5">
        <Avatar name={profile.displayName} photoUrl={profile.photoUrl} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-[26px] leading-tight font-bold break-words">
            {profile.displayName}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
            <AvailabilityBadge availability={profile.availability} />
            {/* HU-030 CA1: solo la zona aproximada de Cali. */}
            <span className="text-muted">· {profile.zone.name}, Cali</span>
          </p>
        </div>
      </header>

      <Card title="Habilidades">
        <Chips items={profile.skills} />
      </Card>

      {profile.experience ? (
        <Card title="Experiencia">
          <p className="text-[15px] break-words whitespace-pre-wrap">{profile.experience}</p>
        </Card>
      ) : null}

      {profile.categories.length > 0 ? (
        <Card title="Le interesa">
          <Chips items={profile.categories.map((category) => category.name)} />
        </Card>
      ) : null}

      <ReputationSummary reputation={profile.reputation} />

      {session.status === 'ready' && session.user?.id !== profile.id ? (
        <ReportButton targetType="USER" targetId={profile.id} profileKind="WORKER" />
      ) : null}

      <Alert tone="warning">
        El teléfono y los datos de contacto solo se comparten con quien lo selecciona, después de
        aceptar un trabajo.
      </Alert>
    </article>
  );
}
