'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@red/ui';
import { profilesApi, type PublicPublisherProfile } from '@/lib/api';

export function PublisherPublicProfile({ id }: { id: string }) {
  const [profile, setProfile] = useState<PublicPublisherProfile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    profilesApi
      .getPublicPublisherProfile(id)
      .then((value) => {
        if (active) {
          setProfile(value);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (status === 'loading') return <p role="status">Cargando perfil…</p>;
  if (status === 'error')
    return (
      <Alert tone="danger" role="alert">
        No pudimos cargar el perfil. Inténtalo de nuevo.
      </Alert>
    );
  if (!profile) return <h1 className="font-display text-3xl font-bold">Perfil no encontrado</h1>;

  return (
    <article className="flex flex-col gap-5">
      {/* Imagen de la API; también admite las imágenes locales de la demo. */}
      <img
        src={profile.photoUrl}
        alt={
          profile.kind === 'COMPANY'
            ? `Logo de ${profile.displayName}`
            : `Foto de ${profile.displayName}`
        }
        className="size-24 rounded-card object-cover"
      />
      <h1 className="font-display text-3xl leading-tight font-bold break-words">
        {profile.displayName}
      </h1>
      {profile.isVerified ? (
        <p className="font-bold text-brand-dark">Identidad verificada</p>
      ) : null}
      <p className="whitespace-pre-wrap break-words text-[15px]">{profile.description}</p>
      <p className="text-[13px] text-muted">Nuevo en la plataforma</p>
    </article>
  );
}
