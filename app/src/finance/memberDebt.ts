import type {Account} from './contracts';

export interface MemberDebt {
  /** Suma należności za zakończone, zatwierdzone mecze, które nie są jeszcze opłacone. */
  totalCents: number;
  matches: {event_id: string; starts_at: string; outstanding_cents: number}[];
  /** Zgłoszone wpłaty czekające na decyzję administratora. */
  pendingCents: number;
  pendingCount: number;
  /** Nadpłata (saldo dodatnie); zaległość i nadpłata nie występują razem. */
  creditCents: number;
  /** Serwer blokuje zapisy na płatne mecze po dwóch zaległych meczach. */
  blocked: boolean;
}

/** Zadłużenie zawodnika w jednej grupie — wyłącznie z DTO serwera, bez własnych przeliczeń salda. */
export function memberDebt(a: Account): MemberDebt {
  const matches = a.dues.filter(d => d.outstanding_cents > 0)
    .map(d => ({event_id: d.event_id, starts_at: d.starts_at, outstanding_cents: d.outstanding_cents}))
    .sort((x, y) => Date.parse(x.starts_at) - Date.parse(y.starts_at));
  const pending = a.payments.filter(p => p.status === 'pending');
  return {
    totalCents: matches.reduce((sum, d) => sum + d.outstanding_cents, 0),
    matches,
    pendingCents: pending.reduce((sum, p) => sum + p.corrected_amount_cents, 0),
    pendingCount: pending.length,
    creditCents: Math.max(0, a.balance_cents),
    blocked: !a.registration_allowed,
  };
}

/** 1 mecz, 2–4 mecze, 5+ meczów (także 12–14). */
export function matchesWord(n: number): string {
  if (n === 1) return 'mecz';
  const last = n % 10, teen = n % 100;
  return last >= 2 && last <= 4 && !(teen >= 12 && teen <= 14) ? 'mecze' : 'meczów';
}
