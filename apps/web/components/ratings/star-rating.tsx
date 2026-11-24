'use client';

import { useId, type Ref } from 'react';

type StarRatingProps = {
  label: string;
  value: number | null;
  onChange(value: number): void;
  error?: string;
  firstInputRef?: Ref<HTMLInputElement>;
};

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      {/* Borde oscuro: contraste ≥ 3:1 contra el blanco (WCAG 1.4.11). */}
      <path
        d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"
        fill={filled ? '#f59e0b' : 'none'}
        stroke={filled ? '#b45309' : '#6b7c76'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Estrellas de 1 a 5 como grupo de radios nativo: se usa con teclado (flechas)
 * y lector de pantalla, con áreas táctiles de 44 px.
 */
export function StarRating({ label, value, onChange, error, firstInputRef }: StarRatingProps) {
  const name = useId();
  const errorId = `${name}-error`;

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="flex flex-col gap-1">
      <legend className="mb-1 text-[15px] font-bold">{label}</legend>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((stars) => (
          <label
            key={stars}
            className="flex size-11 cursor-pointer items-center justify-center rounded-field has-focus-visible:outline-3 has-focus-visible:outline-brand"
          >
            <input
              ref={stars === 1 ? firstInputRef : undefined}
              type="radio"
              name={name}
              value={stars}
              checked={value === stars}
              onChange={() => onChange(stars)}
              aria-invalid={error ? true : undefined}
              className="sr-only"
            />
            <span className="sr-only">{stars === 1 ? '1 estrella' : `${stars} estrellas`}</span>
            <Star filled={value !== null && stars <= value} />
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
