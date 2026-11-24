'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button';
import {
  catalogsApi,
  profilesApi,
  type Category,
  type OwnWorkerProfile,
  type UpdateWorkerProfileRequest,
  type Zone,
} from '@/lib/api';
import { PHOTO_TYPES, photoSchema } from '@/lib/profiles/worker-schema';
import { MY_REPUTATION_PATH, ROUTES, workerPublicPath } from '@/lib/routes';
import { useCurrentUser } from '@/lib/session/use-current-user';
import { Avatar } from './avatar';
import { ToggleSwitch } from './toggle-switch';
import { AvailabilityBadge } from './worker-public-profile';
import { WorkerProfileEditForm } from './worker-profile-edit-form';

type Loaded = { profile: OwnWorkerProfile; zones: Zone[]; categories: Category[] };
type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'no_profile' }
  | ({ status: 'ready' } & Loaded);

type Setting = 'availability' | 'showPhoto' | 'showExperience';

/** Foto propia: se descarga con el token porque puede estar oculta para los demás. */
function useOwnPhoto(photoUrl: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photoUrl || typeof URL.createObjectURL !== 'function') return;
    let active = true;
    let objectUrl: string | null = null;
    profilesApi
      .getOwnWorkerPhoto()
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
      if (objectUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(objectUrl);
    };
  }, [photoUrl]);
  return url;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-4">
      <h2 className="text-xs font-bold tracking-widest text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

/**
 * "Mi perfil" del trabajador: disponibilidad (HU-032 CA2), privacidad del
 * perfil público (HU-030 CA4), foto y datos del perfil (HU-032 CA1).
 */
export function MyProfile() {
  const router = useRouter();
  const session = useCurrentUser();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [saving, setSaving] = useState<Setting | 'photo' | null>(null);
  const [settingError, setSettingError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const user = session.status === 'ready' ? session.user : null;
  const noSession = session.status === 'ready' && user === null;

  useEffect(() => {
    if (noSession) router.replace(ROUTES.login);
  }, [noSession, router]);

  useEffect(() => {
    if (session.status !== 'ready' || !session.user) return;
    if (!session.user.hasWorkerProfile) {
      setState({ status: 'no_profile' });
      return;
    }
    let active = true;
    Promise.all([
      profilesApi.getOwnWorkerProfile(),
      catalogsApi.listZones(),
      catalogsApi.listCategories(),
    ])
      .then(([profile, zones, categories]) => {
        if (!active) return;
        setState(
          profile ? { status: 'ready', profile, zones, categories } : { status: 'no_profile' },
        );
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [session]);

  const profile = state.status === 'ready' ? state.profile : undefined;
  const ownPhoto = useOwnPhoto(profile?.photoUrl);

  function replaceProfile(next: OwnWorkerProfile) {
    setState((current) => (current.status === 'ready' ? { ...current, profile: next } : current));
  }

  async function saveSetting(setting: Setting, changes: UpdateWorkerProfileRequest) {
    setSaving(setting);
    setSettingError(null);
    try {
      const result = await profilesApi.updateWorkerProfile(changes);
      if (result.ok) replaceProfile(result.profile);
      else setSettingError('No pudimos guardar el cambio. Inténtalo de nuevo.');
    } catch {
      setSettingError('No pudimos guardar el cambio. Inténtalo de nuevo.');
    } finally {
      setSaving(null);
    }
  }

  async function changePhoto(file: File | null) {
    if (!file) return;
    setPhotoError(null);
    const check = photoSchema.safeParse(file);
    if (!check.success) {
      setPhotoError(check.error.issues[0]?.message ?? 'La foto no es válida.');
      return;
    }
    setSaving('photo');
    try {
      const result = await profilesApi.replaceWorkerPhoto(file);
      if (result.ok) replaceProfile(result.profile);
      else
        setPhotoError(
          result.reason === 'too_large'
            ? 'La foto no puede pesar más de 5 MB.'
            : (result.message ?? 'La foto debe ser JPG, PNG o WebP.'),
        );
    } catch {
      setPhotoError('No pudimos cambiar la foto. Inténtalo de nuevo.');
    } finally {
      setSaving(null);
    }
  }

  if (session.status === 'error' || state.status === 'error') {
    return (
      <Alert tone="danger" role="alert">
        No pudimos cargar tu perfil. Recarga la página para intentarlo de nuevo.
      </Alert>
    );
  }

  if (state.status === 'no_profile') {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-3xl leading-tight font-bold">Mi perfil</h1>
        <Alert tone="info">
          Aún no tienes perfil de trabajador. Créalo para postularte y recibir oportunidades.
        </Alert>
        <ButtonLink href={ROUTES.workerProfile}>Crear perfil de trabajador</ButtonLink>
        {user?.publisherProfileId ? (
          <ButtonLink href={`/publicadores/${user.publisherProfileId}`} variant="secondary">
            Ver mi perfil de publicador
          </ButtonLink>
        ) : null}
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <p role="status" className="text-[15px] text-muted">
        Cargando tu perfil…
      </p>
    );
  }

  const { zones, categories } = state;
  const current = state.profile;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3.5">
        <Avatar name={current.displayName} photoUrl={ownPhoto} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-[26px] leading-tight font-bold break-words">
            {current.displayName}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
            <AvailabilityBadge availability={current.availability} />
            <span className="text-muted">· {current.zone.name}, Cali</span>
          </p>
        </div>
      </header>

      <nav aria-label="Mi perfil" className="flex flex-wrap gap-x-5">
        <Link
          href={workerPublicPath(current.id)}
          className="inline-flex min-h-11 items-center text-[15px] font-bold text-brand underline underline-offset-2"
        >
          Ver mi perfil público
        </Link>
        <Link
          href={MY_REPUTATION_PATH}
          className="inline-flex min-h-11 items-center text-[15px] font-bold text-brand underline underline-offset-2"
        >
          Ver mi reputación
        </Link>
      </nav>

      {settingError ? (
        <Alert tone="danger" role="alert">
          {settingError}
        </Alert>
      ) : null}

      <Section title="Disponibilidad">
        <ToggleSwitch
          label="Disponible para trabajar"
          description="Si no estás disponible, no recibes recomendaciones ni apareces como disponible. Tus postulaciones vigentes se conservan."
          checked={current.availability === 'AVAILABLE'}
          disabled={saving !== null}
          onChange={(available) =>
            saveSetting('availability', { availability: available ? 'AVAILABLE' : 'UNAVAILABLE' })
          }
        />
      </Section>

      <Section title="Privacidad del perfil público">
        <ToggleSwitch
          label="Mostrar mi foto"
          description="Si la ocultas, los demás verán tus iniciales."
          checked={current.showPhoto}
          disabled={saving !== null}
          onChange={(show) => saveSetting('showPhoto', { showPhoto: show })}
        />
        <ToggleSwitch
          label="Mostrar mi experiencia"
          checked={current.showExperience}
          disabled={saving !== null}
          onChange={(show) => saveSetting('showExperience', { showExperience: show })}
        />
        <p className="text-[13px] text-muted">
          Tu correo, teléfono y dirección nunca se muestran. El teléfono solo lo ve quien te
          selecciona, después de aceptar un trabajo.
        </p>
      </Section>

      <Section title="Foto de perfil">
        <div className="flex flex-col gap-1">
          <label className="inline-flex h-11 w-fit cursor-pointer items-center rounded-field border border-line bg-white px-4 text-[15px] font-bold has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand hover:bg-brand-soft">
            Cambiar foto
            <input
              type="file"
              accept={PHOTO_TYPES.join(',')}
              disabled={saving !== null}
              aria-invalid={photoError ? true : undefined}
              aria-describedby="foto-ayuda"
              className="sr-only"
              onChange={(event) => {
                void changePhoto(event.target.files?.[0] ?? null);
                event.target.value = '';
              }}
            />
          </label>
          <p id="foto-ayuda" className="text-[13px] text-muted">
            JPG, PNG o WebP de hasta 5 MB. Se guarda al elegirla.
          </p>
          {photoError ? (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {photoError}
            </p>
          ) : null}
        </div>
        {saving === 'photo' ? (
          <p role="status" className="text-[13px] text-muted">
            Subiendo foto…
          </p>
        ) : null}
      </Section>

      <WorkerProfileEditForm
        profile={current}
        zones={zones}
        categories={categories}
        onSaved={replaceProfile}
      />
    </div>
  );
}
