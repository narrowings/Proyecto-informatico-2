import { redirect } from 'next/navigation';

/** /admin lleva a la cola de reportes. */
export default function AdminHome() {
  redirect('/admin/reportes');
}
