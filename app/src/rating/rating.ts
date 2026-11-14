// SLM Rating 1.0 + MVP Gold — czysta logika domenowa (bez UI i bez backendu).
// Źródło: docs/rating/SLM_RATING_1_0_MVP_GOLD.md (zatwierdzone założenia 13.11.2026).
// Wzór ratingu (wagi, premie, stabilizacja) NIE jest zatwierdzony — patrz PROVISIONAL_WEIGHTS.

export const RATING_MIN = 1;
export const RATING_MAX = 10;
export const RATING_START = 7;
export const MIN_RATED_MATCHES_FOR_CHANGE = 5;
export const RATING_WINDOW_HOURS = 48;
export const MVP_GOLD_VALID_DAYS = 7;
/** Remis na 1. miejscu = 0,25 MVP akumulacyjnego; liczone w ćwiartkach, by uniknąć błędów float. */
export const MVP_TIE_QUARTERS = 1;
export const MVP_QUARTERS_PER_ACCUMULATED = 4;

/** Wstępne wagi wpływu — wyłącznie propozycja, nie algorytm; frekwencja tylko na plus, premie z limitem. */
export const PROVISIONAL_WEIGHTS = { peers: 0.8, mvp: 0.12, goalsAssists: 0.05, attendance: 0.03 } as const;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const clampRating = (value: number): number =>
  Number.isFinite(value) ? Math.min(RATING_MAX, Math.max(RATING_MIN, value)) : RATING_START;

/** Rating 1–10 → liczba gwiazdek 0–5 z dokładnością do połówki (7,0 → 3,5). */
export function starsFromRating(rating: number): number {
  const stars = clampRating(rating) / 2;
  return Math.round(stars * 2) / 2;
}

/** Wypełnienie pięciu gwiazdek (0, 0.5 albo 1 każda). */
export function starFills(rating: number): number[] {
  const stars = starsFromRating(rating);
  return Array.from({ length: 5 }, (_, i) => Math.min(1, Math.max(0, stars - i)));
}

/** Polski zapis z jednym miejscem po przecinku: 7 → „7,0". */
export const formatRating = (rating: number): string => clampRating(rating).toFixed(1).replace('.', ',');
/** Dokładny wynik pokazywany w chmurce po dotknięciu gwiazdek, np. 7,43. */
export const formatRatingPrecise = (rating: number): string => clampRating(rating).toFixed(2).replace('.', ',');

export const ratingChangeUnlocked = (ratedMatches: number): boolean => ratedMatches >= MIN_RATED_MATCHES_FOR_CHANGE;

export const ratingWindowClosesAt = (matchEndedAt: Date): Date => new Date(matchEndedAt.getTime() + RATING_WINDOW_HOURS * HOUR);
export const ratingWindowOpen = (matchEndedAt: Date, now: Date): boolean =>
  now.getTime() >= matchEndedAt.getTime() && now.getTime() < ratingWindowClosesAt(matchEndedAt).getTime();

/** Ocena: tylko uczestnik meczu, tylko innego uczestnika, wartość całkowita 1–10. */
export function canRate(voterId: string, targetId: string, participantIds: readonly string[], score: number): boolean {
  return voterId !== targetId && participantIds.includes(voterId) && participantIds.includes(targetId)
    && Number.isInteger(score) && score >= RATING_MIN && score <= RATING_MAX;
}

export interface MvpVote { voterId: string; targetId: string }
export interface MvpResult {
  /** Czy głosowanie jest ważne (kworum: co najmniej połowa uczestników). */
  valid: boolean;
  quorum: number;
  counted: number;
  /** Wyniki per zawodnik (tylko policzone głosy). */
  tally: Record<string, number>;
  /** Zwycięzcy: 1 osoba = MVP Gold; 2+ = remis (po 0,25 MVP akumulacyjnego). */
  winners: string[];
  outcome: 'no_quorum' | 'no_votes' | 'gold' | 'tie';
}

/** Kworum: minimum połowa uczestników, zaokrąglona w górę (5/10, 6/12, 4/7). */
export const mvpQuorum = (participants: number): number => Math.ceil(participants / 2);

/** Liczy głosy MVP: jeden głos na uczestnika, bez głosu na siebie, bez obcych; ostatni głos zastępuje poprzedni. */
export function resolveMvp(votes: readonly MvpVote[], participantIds: readonly string[]): MvpResult {
  const members = new Set(participantIds);
  const last = new Map<string, string>();
  for (const v of votes) {
    if (v.voterId !== v.targetId && members.has(v.voterId) && members.has(v.targetId)) last.set(v.voterId, v.targetId);
  }
  const quorum = mvpQuorum(members.size);
  const tally: Record<string, number> = {};
  for (const target of last.values()) tally[target] = (tally[target] ?? 0) + 1;
  const base = { quorum, counted: last.size, tally };
  if (members.size === 0 || last.size < quorum) return { ...base, valid: false, winners: [], outcome: 'no_quorum' };
  const top = Math.max(0, ...Object.values(tally));
  if (top === 0) return { ...base, valid: true, winners: [], outcome: 'no_votes' };
  const winners = Object.keys(tally).filter(id => tally[id] === top).sort();
  return { ...base, valid: true, winners, outcome: winners.length === 1 ? 'gold' : 'tie' };
}

/** Ćwiartki (po 0,25) → liczba pełnych MVP akumulacyjnych (4 remisy = 1). */
export const accumulatedMvp = (tieQuarters: number): number => Math.floor(Math.max(0, tieQuarters) / MVP_QUARTERS_PER_ACCUMULATED);
export const tieQuartersAfter = (previous: number, result: MvpResult, playerId: string): number =>
  result.outcome === 'tie' && result.winners.includes(playerId) ? previous + MVP_TIE_QUARTERS : previous;

export interface PlayedMatch {
  endedAt: Date;
  /** Głosowanie MVP w tym meczu rozstrzygnięte jako ważne (kworum). */
  voteValid: boolean;
  /** Zawodnik zdobył w nim MVP Gold. */
  wonGold: boolean;
}

/**
 * MVP Gold aktywny przez 7 dni od meczu, który go przyniósł. Wygasa wcześniej tylko wtedy, gdy zawodnik
 * rozegrał późniejszy mecz z ważnym głosowaniem i nie obronił Gold. Brak kworum niczego nie odbiera.
 * Ponowny Gold odnawia okres od nowego meczu. Mecze w dowolnej kolejności.
 */
export function mvpGoldActive(matches: readonly PlayedMatch[], now: Date): boolean {
  const ordered = [...matches].sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime());
  let anchor = -1;
  for (let i = 0; i < ordered.length; i++) if (ordered[i].wonGold) anchor = i;
  if (anchor < 0) return false;
  const expiresAt = ordered[anchor].endedAt.getTime() + MVP_GOLD_VALID_DAYS * DAY;
  if (now.getTime() >= expiresAt) return false;
  return !ordered.slice(anchor + 1).some(m => m.voteValid && !m.wonGold && m.endedAt.getTime() <= now.getTime());
}
