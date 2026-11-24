'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin.http';
export default function CategoriesPage() {
  const [items, setItems] = useState<any[]>();
  useEffect(() => {
    void adminApi.categories().then(setItems);
  }, []);
  return (
    <section>
      <h2 className="font-display text-2xl font-bold">Categorías</h2>
      {items?.map((item: any) => (
        <p key={item.id}>
          {item.name} · {item.isActive ? 'Activa' : 'Inactiva'}
        </p>
      )) ?? <p>Cargando…</p>}
    </section>
  );
}
