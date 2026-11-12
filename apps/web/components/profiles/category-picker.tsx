'use client';

import { useId, type Ref } from 'react';
import type { Category } from '@/lib/api';

type CategoryPickerProps = {
  categories: Category[];
  value: number[];
  onChange(ids: number[]): void;
  error?: string;
  firstInputRef?: Ref<HTMLInputElement>;
};

/** Categorías de interés como casillas con forma de etiqueta (área táctil de 44 px). */
export function CategoryPicker({
  categories,
  value,
  onChange,
  error,
  firstInputRef,
}: CategoryPickerProps) {
  const errorId = useId();

  function toggle(id: number, checked: boolean) {
    onChange(checked ? [...value, id] : value.filter((v) => v !== id));
  }

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="flex flex-col gap-2">
      <legend className="mb-1.5 text-[13px] font-bold">Categorías de interés</legend>
      <div className="flex flex-wrap gap-2">
        {categories.map((category, index) => {
          const checked = value.includes(category.id);
          return (
            <label
              key={category.id}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-[14px] font-medium has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand ${
                checked ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink'
              } ${error && !checked ? 'border-danger' : ''}`}
            >
              <input
                ref={index === 0 ? firstInputRef : undefined}
                type="checkbox"
                checked={checked}
                onChange={(event) => toggle(category.id, event.target.checked)}
                aria-invalid={error ? true : undefined}
                className="sr-only"
              />
              {checked ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12l5 5 9-10" />
                </svg>
              ) : null}
              {category.name}
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
