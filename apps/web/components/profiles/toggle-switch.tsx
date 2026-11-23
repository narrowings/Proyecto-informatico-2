'use client';

import { useId } from 'react';

type ToggleSwitchProps = {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
};

/** Interruptor accesible (role="switch") con área táctil de 44 px. */
export function ToggleSwitch({
  label,
  description,
  checked,
  disabled,
  onChange,
}: ToggleSwitchProps) {
  const id = useId();
  const descriptionId = `${id}-description`;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={`${id}-label`} className="text-[15px] font-bold">
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="text-[13px] text-muted">
            {description}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? descriptionId : undefined}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (!disabled) onChange(!checked);
        }}
        className="flex h-11 w-15 shrink-0 cursor-pointer items-center rounded-full focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand aria-disabled:cursor-wait aria-disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className={`flex h-8 w-14 items-center rounded-full p-1 transition-colors ${
            // Apagado: contraste ≥ 3:1 contra el fondo (WCAG 1.4.11).
            checked ? 'bg-brand' : 'bg-[#6b7c76]'
          }`}
        >
          <span
            className={`size-6 rounded-full bg-white shadow transition-transform ${
              checked ? 'translate-x-6' : ''
            }`}
          />
        </span>
      </button>
    </div>
  );
}
