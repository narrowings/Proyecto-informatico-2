'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin.http';
import type { AdminPage, AdminUser } from '@/lib/api/admin';
export default function UsersPage() {
  const [data, setData] = useState<AdminPage<AdminUser>>();
  useEffect(() => {
    void adminApi.users(new URLSearchParams('page=1&pageSize=20')).then(setData);
  }, []);
  return (
    <section>
      <h2 className="font-display text-2xl font-bold">Usuarios</h2>
      {data?.items?.map((user) => (
        <div key={user.id} className="mt-3 rounded-card border border-line p-4">
          <strong>{user.name}</strong>
          <p>
            {user.email} · {user.status}
          </p>
        </div>
      )) ?? <p>Cargando…</p>}
    </section>
  );
}



