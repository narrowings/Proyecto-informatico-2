/** Montos en pesos colombianos enteros, sin decimales: `$ 150.000`. */
export function formatCop(amount: number): string {
  return `$ ${Math.trunc(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** "Intenta de nuevo en 3 minutos" a partir de `retryAfter` (segundos) de un 429. */
export function waitMessage(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Inténtalo de nuevo más tarde.';
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1
    ? 'Inténtalo de nuevo en 1 minuto.'
    : `Inténtalo de nuevo en ${minutes} minutos.`;
}
