'use client';

import { useEffect, useId, useState, type Ref } from 'react';
import { PHOTO_TYPES } from '@/lib/profiles/worker-schema';

type PhotoInputProps = {
  value: File | null;
  onChange(file: File | null): void;
  name: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  label?: string;
};

/** Foto de perfil con vista previa. La validación de tipo y peso vive en el esquema. */
export function PhotoInput({
  value,
  onChange,
  name,
  error,
  inputRef,
  label = 'foto',
}: PhotoInputProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value || typeof URL.createObjectURL !== 'function') {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex items-center gap-4">
      <div
        aria-hidden="true"
        className={`flex size-18 shrink-0 items-center justify-center overflow-hidden rounded-full font-display text-[28px] font-extrabold text-white ${
          error ? 'bg-danger' : 'bg-brand'
        }`}
      >
        {preview ? (
          // Vista previa local (blob:); next/image no aplica a URLs de objeto.
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          initials || '?'
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <label
          htmlFor={id}
          className="inline-flex h-11 w-fit cursor-pointer items-center rounded-field border border-line bg-white px-4 text-[15px] font-bold has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand hover:bg-brand-soft"
        >
          {value ? `Cambiar ${label}` : `Subir ${label}`}
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={PHOTO_TYPES.join(',')}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            className="sr-only"
            onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          />
        </label>
        <p id={hintId} className="text-[13px] text-muted">
          {value ? value.name : 'JPG, PNG o WebP de hasta 5 MB.'}
        </p>
        {error ? (
          <p id={errorId} className="text-[13px] font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
