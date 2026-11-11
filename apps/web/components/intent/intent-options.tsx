import Link from 'next/link';
import { ROUTES } from '@/lib/routes';

type Option = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  className: string;
  eyebrowClassName?: string;
  descriptionClassName?: string;
};

const OPTIONS: Option[] = [
  {
    href: ROUTES.work,
    eyebrow: 'Quiero trabajar',
    title: 'Ver oportunidades para mí',
    description: 'Tareas, trabajos por horas, servicios y empleo cerca de ti.',
    className: 'bg-brand text-white hover:bg-brand-dark',
  },
  {
    href: ROUTES.publish,
    eyebrow: 'Necesito ayuda',
    title: 'Publicar una necesidad',
    description: 'Cuenta qué, cuándo y cuánto pagas. Te llegan interesados.',
    className: 'bg-amber text-ink hover:brightness-95',
  },
  {
    href: ROUTES.activity,
    eyebrow: 'Mi actividad',
    title: 'Trabajos y reputación',
    description: 'Postulaciones, acuerdos y calificaciones en un solo lugar.',
    className: 'border border-line bg-white text-ink hover:bg-brand-soft',
    eyebrowClassName: 'text-brand',
    descriptionClassName: 'text-muted',
  },
];

function Arrow() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Las tres intenciones del inicio (HU-022 CA1), como en la pantalla "1 · Inicio" del diseño. */
export function IntentOptions() {
  return (
    <ul className="flex flex-col gap-3">
      {OPTIONS.map((option) => (
        <li key={option.href}>
          <Link
            href={option.href}
            className={`flex items-center gap-3 rounded-[22px] p-5 transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand ${option.className}`}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                className={`text-xs font-bold tracking-widest uppercase ${option.eyebrowClassName ?? ''}`}
              >
                {option.eyebrow}
              </span>
              <span className="font-display text-[22px] leading-tight font-bold">
                {option.title}
              </span>
              <span className={`text-sm leading-snug ${option.descriptionClassName ?? ''}`}>
                {option.description}
              </span>
            </span>
            <Arrow />
          </Link>
        </li>
      ))}
    </ul>
  );
}
