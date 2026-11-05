import { useId, type ComponentProps, type ReactNode } from 'react';

type SelectProps = Omit<ComponentProps<'select'>, 'id'> & {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
};

/** Lista desplegable nativa con el mismo estilo y accesibilidad que `Field`. */
export function Select({ label, hint, error, className = '', children, ...select }: SelectProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold">
        {label}
      </label>
      <select
        {...select}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`h-12 w-full rounded-field border bg-white px-3 text-[15px] text-ink focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-brand ${
          error ? 'border-danger' : 'border-line'
        } ${className}`}
      >
        {children}
      </select>
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
