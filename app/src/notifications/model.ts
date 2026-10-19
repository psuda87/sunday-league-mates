export const categories = {
  new_match: 'Nowe mecze', vacancy: 'Zwolnione miejsca', reminder: 'Przypomnienia o meczu',
  match_changed: 'Zmiany i odwołania', finance: 'Decyzje finansowe',
};
export type Category = keyof typeof categories;
export interface NotificationItem {
  match_id?: string | null; id: string; category: Category; kind: string; event_id: string | null; title: string; body: string;
  created_at: string; read_at: string | null;
}
export interface NotificationList { notifications: NotificationItem[]; unread: number; preferences: Record<Category, boolean> }
export function notificationId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const value = (data as Record<string, unknown>).notification_id;
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
