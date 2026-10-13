export interface Match {
  id: string; starts_at: string; location: string; duration_minutes: number;
  hourly_rate: number; total_cost: number; capacity: number; status: 'scheduled' | 'cancelled';
  registered_count: number; reserve_count: number; registration_open: boolean;
  decision_required: boolean; cutoff_at: string; estimated_per_person: number | null;
  settlements_active: false;
}
export interface Participant {
  id: string; member_id: string | null; responsible_user_id: string;
  status: 'registered' | 'reserve'; absent: boolean; display_name: string;
  guest_name: string | null; guest_phone: string | null; responsible_name: string; contact_phone: string;
}
export interface Detail { event: Match; participants: Participant[]; server_now: string }
export interface MatchForm {
  date: string; time: string; location: string; duration_minutes: string;
  hourly_rate: string; total_cost: string; capacity: string;
}
export const emptyMatchForm = (): MatchForm => ({ date: '', time: '', location: '', duration_minutes: '90',
  hourly_rate: '180', total_cost: '270', capacity: '' });
export function warsawFields(iso: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const value = (name: string) => parts.find(p => p.type === name)!.value;
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}` };
}
export function nextMatchDay(serverNow: string, weekday: 0 | 4): string {
  const date = new Date(warsawFields(serverNow).date + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + ((weekday - date.getUTCDay() + 7) % 7));
  return date.toISOString().slice(0, 10);
}
export const money = (value: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);
export const matchDate = (value: string) => new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw', dateStyle: 'full', timeStyle: 'short',
}).format(new Date(value));
