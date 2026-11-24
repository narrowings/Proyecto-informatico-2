import { z } from 'zod';
import { authenticated, postJson } from './http';
import type { NotificationsApi } from './notifications';

export const notificationsApi: NotificationsApi = {
  list(page, pageSize = 20) {
    return authenticated(`/notifications?page=${page}&pageSize=${pageSize}`);
  },
  unreadCount() {
    return authenticated('/notifications/unread-count');
  },
  markAsRead(id) {
    if (!z.uuid().safeParse(id).success) return Promise.reject(new Error('Identificador inválido'));
    return authenticated(`/notifications/${encodeURIComponent(id)}/read`, postJson({}));
  },
  markAllAsRead() {
    return authenticated('/notifications/read-all', postJson({}));
  },
};
