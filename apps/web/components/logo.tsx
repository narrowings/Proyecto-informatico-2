/** Marca de la plataforma, igual a la del diseño (pantalla Inicio). */
export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-brand text-white">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="18" cy="18" r="2.5" />
          <path d="M8.2 11l7.6-4M8.2 13l7.6 4" />
        </svg>
      </div>
      <span className="font-display text-[17px] leading-tight font-bold">Red de Oportunidades</span>
      <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold tracking-widest text-brand">
        CALI
      </span>
    </div>
  );
}
