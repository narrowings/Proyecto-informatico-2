import { useId, type ComponentProps, type ReactNode } from 'react';

type CheckboxProps = Omit<ComponentProps<'input'>, 'id' | 'type'> & {
  label: ReactNode;
  error?: ReactNode;
};

/** Casilla con área táctil de 44 px o más; el error se marca con borde y con texto. */
export function Checkbox({ label, error, ...input }: CheckboxProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-field border bg-white px-3.5 py-2.5 text-[15px] leading-snug ${
          error ? 'border-danger' : 'border-line'
        }`}
      >
        <input
          {...input}
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-px size-6 shrink-0 cursor-pointer accent-brand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        <span>{label}</span>
      </label>
      {error ? (
        <p id={errorId} className="px-1 text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
