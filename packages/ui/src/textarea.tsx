'use client';

import { useId, type ComponentProps, type ReactNode } from 'react';

type TextareaProps = ComponentProps<'textarea'> & {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
};

/** Texto largo con el mismo estilo y accesibilidad que `Field`. */
export function Textarea({
  label,
  hint,
  error,
  className = '',
  id: providedId,
  'aria-describedby': externalDescription,
  'aria-invalid': invalid,
  ...textarea
}: TextareaProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [externalDescription, hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold">
        {label}
      </label>
      <textarea
        {...textarea}
        id={id}
        aria-invalid={error ? true : invalid}
        aria-describedby={describedBy || undefined}
        className={`min-h-28 w-full rounded-field border bg-white px-3.5 py-3 text-[15px] text-ink focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted ${
          error ? 'border-danger' : 'border-control-border'
        } ${className}`}
      />
      {hint ? (
        <p id={hintId} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
