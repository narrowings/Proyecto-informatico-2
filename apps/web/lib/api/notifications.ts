import type { Page } from './ratings';
export type InboxItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};
export type InboxPage = Page<InboxItem> & { unread: number };
