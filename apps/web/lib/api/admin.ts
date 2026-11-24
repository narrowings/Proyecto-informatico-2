export type AdminPage<T> = { items: T[]; total: number; page: number; pageSize: number };
export type AdminRecord = Record<string, string | number | boolean | null | undefined>;
export type AdminApi = {
  reports(query?: string): Promise<AdminPage<AdminRecord>>;
  users(query?: string): Promise<AdminPage<AdminRecord>>;
  audit(query?: string): Promise<AdminPage<AdminRecord>>;
  categories(): Promise<AdminRecord[]>;
  rules(): Promise<AdminRecord[]>;
  action(path: string, body: object): Promise<unknown>;
};
