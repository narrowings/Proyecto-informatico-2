const SIZES = {
  md: 'size-11 text-base',
  lg: 'size-18 text-[28px]',
} as const;

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

/**
 * Foto de perfil o, si no hay foto o está oculta (HU-030), las iniciales.
 * Nunca deja un hueco roto.
 */
export function Avatar({
  name,
  photoUrl,
  size = 'lg',
}: {
  name: string;
  photoUrl: string | null;
  size?: keyof typeof SIZES;
}) {
  const box = `flex shrink-0 items-center justify-center overflow-hidden rounded-full ${SIZES[size]}`;
  if (photoUrl) {
    return <img src={photoUrl} alt={`Foto de ${name}`} className={`${box} object-cover`} />;
  }
  return (
    <div aria-hidden="true" className={`${box} bg-brand font-display font-extrabold text-white`}>
      {initials(name)}
    </div>
  );
}
