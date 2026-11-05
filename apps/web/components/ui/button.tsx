import Link from 'next/link';
import type { ComponentProps } from 'react';

type Variant = 'primary' | 'secondary';

const base =
  'inline-flex h-13 w-full items-center justify-center rounded-control px-6 text-base font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-dark aria-disabled:cursor-not-allowed aria-disabled:bg-line aria-disabled:text-muted aria-disabled:hover:bg-line',
  secondary: 'border border-line bg-white text-ink hover:bg-brand-soft',
};

export function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
