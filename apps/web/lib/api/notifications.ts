export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export type NotificationsPage = {
  items: NotificationItem[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
};

export type NotificationsApi = {
  list(page: number, pageSize?: number): Promise<NotificationsPage>;
  unreadCount(): Promise<{ unread: number }>;
  markAsRead(id: string): Promise<{ id: string; link: string | null }>;
  markAllAsRead(): Promise<{ updated: number }>;
};
