'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin.http';
import { Alert } from '@/components/ui/alert';
export default function ReportsPage() {
  const [data, setData] = useState<any>();
  const [error, setError] = useState(false);
  useEffect(() => {
    void adminApi
      .reports('status=PENDING&page=1&pageSize=20')
      .then(setData)
      .catch(() => setError(true));
  }, []);
  if (error) return <Alert tone="danger">No pudimos cargar los reportes.</Alert>;
  return (
    <section>
      <h2 className="font-display text-2xl font-bold">Reportes</h2>
      {!data ? (
        <p>Cargando…</p>
      ) : data.items.length ? (
        <ul>
          {data.items.map((item: any) => (
            <li
              key={`${item.targetType}-${item.targetId}`}
              className="mt-3 rounded-card border border-line p-4"
            >
              <strong>{item.target?.title ?? item.target?.name ?? 'Elemento reportado'}</strong>
              <p>{item.reportCount} reportes</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No hay reportes pendientes.</p>
      )}
    </section>
  );
}
