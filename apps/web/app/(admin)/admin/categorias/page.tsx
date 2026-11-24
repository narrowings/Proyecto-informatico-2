'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin.http';
import type { AdminCategory } from '@/lib/api/admin';
export default function CategoriesPage() {
  const [items, setItems] = useState<AdminCategory[]>();
  useEffect(() => {
    void adminApi.categories().then(setItems);
  }, []);
  return (
    <section>
      <h2 className="font-display text-2xl font-bold">Categorías</h2>
      {items?.map((item) => (
        <p key={item.id}>
          {item.name} · {item.isActive ? 'Activa' : 'Inactiva'}
        </p>
      )) ?? <p>Cargando…</p>}
    </section>
  );
}


