'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';

type Variant = 'primary' | 'secondary';

const base =
  'inline-flex min-h-13 w-full items-center justify-center rounded-control px-6 py-3 text-base font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-line disabled:text-muted disabled:hover:bg-line aria-disabled:cursor-not-allowed aria-disabled:bg-line aria-disabled:text-muted aria-disabled:hover:bg-line';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  secondary: 'border border-control-border bg-white text-ink hover:bg-brand-soft',
};

export function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  onClick,
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
      onClick={(event) => {
        if (props['aria-disabled'] === true || props['aria-disabled'] === 'true') {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  onClick,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
      onClick={(event) => {
        if (props['aria-disabled'] === true || props['aria-disabled'] === 'true') {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}
