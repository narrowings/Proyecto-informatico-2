import { authenticated } from './http';
import type { InboxPage } from './notifications';

export const notificationsApi = {
  list: (page: number) => authenticated<InboxPage>(`/notifications?page=${page}&pageSize=20`),
  count: () => authenticated<{ unread: number }>('/notifications/unread-count'),
  read: (id: string) =>
    authenticated<{ id: string; link: string | null }>(
      '/notifications/' + encodeURIComponent(id) + '/read',
      { method: 'POST' },
    ),
  readAll: () => authenticated<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
};
