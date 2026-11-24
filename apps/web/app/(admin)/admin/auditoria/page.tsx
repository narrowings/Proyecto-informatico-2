'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin.http';
export default function AuditPage() {
  const [data, setData] = useState<any>();
  useEffect(() => {
    void adminApi.audit('page=1&pageSize=20').then(setData);
  }, []);
  return (
    <section>
      <h2 className="font-display text-2xl font-bold">Auditoría</h2>
      {data?.items?.map((item: any) => (
        <p key={item.id}>
          {item.action} · {item.reason ?? 'Sin motivo'}
        </p>
      )) ?? <p>Cargando…</p>}
    </section>
  );
}
