export interface LedgerEntry {
  id: number; event_id: string | null; participant_id: string | null; payment_id: string | null;
  amount_cents: number; kind: 'charge' | 'charge_correction' | 'payment' | 'payment_correction';
  actor_id: string; reason: string; created_at: string;
  actor_name: string | null; participant_name: string | null; starts_at: string | null; is_guest: boolean;
}
export interface Payment {
  id: string; user_id: string; amount_cents: number; corrected_amount_cents: number;
  status: 'pending' | 'accepted' | 'rejected'; note: string; created_at: string;
  display_name?: string;
}
export interface Due {
  event_id: string; starts_at: string; due_cents: number; covered_cents: number; outstanding_cents: number;
}
export interface Audit {
  id: number; actor_id: string; action: string; reason: string; created_at: string; snapshot: unknown;
}
export interface FinanceAccount {
  user_id: string; balance_cents: number; unpaid_matches: number; blocked: boolean;
  dues: Due[]; history: LedgerEntry[]; payments: Payment[]; decisions: Audit[];
}
export interface Share {
  participant_id: string; responsible_user_id: string; name: string; status: 'registered' | 'reserve' | 'withdrawn';
  absent: boolean; payable: boolean; charge_override: boolean | null; replacement_id: string | null; amount_cents: number;
}
export interface Revision {
  id: number; revision: number; cost_cents: number; actor_id: string; reason: string; created_at: string;
}
export interface SettlementDetail {
  event_id: string; starts_at: string; timezone: string; status: 'scheduled' | 'cancelled';
  cost_cents: number; version: number; revision: number; approved_at: string | null; can_approve: boolean;
  participants: Share[]; revisions: Revision[]; audit: Audit[];
}
// Konwersja tekstu formularza, bez arytmetyki zmiennoprzecinkowej. Serwer waliduje ponownie.
export function parseCents(value: string, allowZero = false): number {
  const match = /^(\d{1,10})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error('Podaj kwotę w złotych z najwyżej dwoma miejscami po przecinku.');
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if ((!allowZero && cents === 0) || cents > 999999999999)
    throw new Error('Wpłata musi być dodatnia, a kwota nie może przekraczać 9 999 999 999,99 zł.');
  return cents;
}
export const centsText = (cents: number) => `${Math.trunc(cents / 100)}.${String(Math.abs(cents % 100)).padStart(2, '0')}`;
export const formatCents = (cents: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(cents / 100);
export const paymentStatus = { pending: 'Oczekuje na zatwierdzenie', accepted: 'Zaksięgowana', rejected: 'Odrzucona' };
export const ledgerKind = { charge: 'Należność', charge_correction: 'Korekta należności', payment: 'Wpłata', payment_correction: 'Korekta wpłaty' };
export const decisionName: Record<string, string> = {
  submit_payment: 'Zgłoszenie wpłaty', record_payment: 'Rejestracja wpłaty', accept_payment: 'Akceptacja wpłaty',
  reject_payment: 'Odrzucenie wpłaty', correct_payment: 'Korekta wpłaty', cost: 'Zmiana kosztu', charge: 'Decyzja o opłacie',
  attendance: 'Zmiana obecności', replacement: 'Zastępstwo', approve: 'Zatwierdzenie',
  events_joined: 'Zapis na mecz', events_withdrawn: 'Rezygnacja', events_reserved: 'Rezerwa',
  events_cancelled: 'Odwołanie', events_attendance: 'Obecność', events_created: 'Utworzenie meczu',
  events_edited: 'Edycja meczu', events_guest_edited: 'Edycja gościa',
  request_abandoned: 'Zamknięcie niezaksięgowanego żądania',
};
