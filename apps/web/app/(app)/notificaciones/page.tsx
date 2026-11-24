import type { Metadata } from 'next';
import { RequireProfile } from '@/components/app/require-profile';
import { NotificationInbox } from '@/components/notifications/notification-inbox';
export const metadata: Metadata = { title: 'Notificaciones | Red de Oportunidades Laborales Cali' };
export default function NotificacionesPage() {
  return (
    <RequireProfile profile="none">
      <NotificationInbox />
    </RequireProfile>
  );
}
