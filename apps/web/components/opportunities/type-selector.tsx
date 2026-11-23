'use client';

import { useId } from 'react';
import type { OpportunityType } from '@/lib/api';
import { OPPORTUNITY_TYPES } from '@/lib/opportunities/types';

/** Elección del tipo de oportunidad con una breve explicación de cada uno (HU-025 CA1 y CA2). */
export function TypeSelector({
  value,
  onChange,
}: {
  value: OpportunityType | null;
  onChange(type: OpportunityType): void;
}) {
  const baseId = useId();

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 text-[13px] font-bold">Tipo de oportunidad</legend>
      {OPPORTUNITY_TYPES.map((type) => {
        const checked = value === type.value;
        const labelId = `${baseId}-${type.value}-label`;
        const descriptionId = `${baseId}-${type.value}-description`;
        return (
          <label
            key={type.value}
            className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-field border px-3.5 py-3 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand ${
              checked ? 'border-brand bg-brand-soft' : 'border-control-border bg-white'
            }`}
          >
            <input
              type="radio"
              name={`${baseId}-type`}
              value={type.value}
              checked={checked}
              onChange={() => onChange(type.value)}
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
              className="mt-0.5 size-5 shrink-0 cursor-pointer accent-brand"
            />
            <span className="flex flex-col gap-0.5">
              <span id={labelId} className="text-[15px] font-bold">
                {type.label}
              </span>
              <span id={descriptionId} className="text-[13px] leading-snug text-muted">
                {type.description}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
