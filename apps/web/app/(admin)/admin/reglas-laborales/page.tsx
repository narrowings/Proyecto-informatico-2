'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin.http';
import type { LaborWarningRule } from '@/lib/api/admin';
export default function RulesPage() {
  const [items, setItems] = useState<LaborWarningRule[]>();
  useEffect(() => {
    void adminApi.rules().then(setItems);
  }, []);
  return (
    <section>
      <h2 className="font-display text-2xl font-bold">Reglas laborales</h2>
      {items?.map((item) => (
        <article key={item.code} className="mt-3 rounded-card border border-line p-4">
          <strong>{item.code}</strong>
          <p>{item.message}</p>
        </article>
      )) ?? <p>Cargando…</p>}
    </section>
  );
}


