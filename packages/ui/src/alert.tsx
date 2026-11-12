import type { ComponentProps } from 'react';

type Tone = 'info' | 'warning' | 'success' | 'danger';

const tones: Record<Tone, string> = {
  info: 'bg-info-bg text-info-ink',
  warning: 'bg-warn-bg text-warn-ink',
  success: 'bg-brand-soft text-brand-dark',
  danger: 'bg-danger-soft text-danger',
};

export function Alert({
  tone = 'info',
  className = '',
  ...props
}: ComponentProps<'div'> & { tone?: Tone }) {
  return (
    <div
      className={`rounded-field px-3.5 py-3 text-[13px] leading-snug ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
