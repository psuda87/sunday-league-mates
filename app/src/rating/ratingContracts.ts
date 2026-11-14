/** Kształty odpowiedzi akcji ratings_* (funkcja Edge accounts → public.slm_ratings_dispatch). */
export interface PlayerRating { user_id: string; rating: number; final: boolean; rated_matches: number; gold?: boolean }
export interface RatingOverview { me: PlayerRating; gold: string[] }
export type RatingPhase = 'disabled' | 'before' | 'open' | 'closed';
export type Team = 'a' | 'b';
export interface MatchRatingState {
  event_id: string; phase: RatingPhase; closes_at: string; can_rate: boolean;
  participants: { user_id: string; team: Team | null; display_name: string }[];
  my: { ratings: Record<string, number>; mvp_user: string | null; action_team: Team | null; goals: number; assists: number };
  score: { a: number; b: number; changed_at: string; changed_by: string } | null;
  reported: { goals_a: number; goals_b: number; assists_a: number; assists_b: number };
  result: { mvp_outcome: 'no_quorum' | 'no_votes' | 'gold' | 'tie'; mvp_user: string | null; action_team: Team | null } | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN);

export function playerRating(value: unknown): PlayerRating {
  if (!isObject(value) || typeof value.user_id !== 'string' || Number.isNaN(num(value.rating)) || typeof value.final !== 'boolean') throw Error('Invalid rating');
  return { user_id: value.user_id, rating: num(value.rating), final: value.final, rated_matches: Number.isNaN(num(value.rated_matches)) ? 0 : num(value.rated_matches), gold: value.gold === true };
}
export function ratingOverview(value: unknown): RatingOverview {
  if (!isObject(value) || !Array.isArray(value.gold) || value.gold.some(id => typeof id !== 'string')) throw Error('Invalid rating overview');
  return { me: playerRating(value.me), gold: value.gold as string[] };
}
export function matchRatingState(value: unknown): MatchRatingState {
  if (!isObject(value) || typeof value.event_id !== 'string' || !['disabled', 'before', 'open', 'closed'].includes(value.phase as string)
    || !Array.isArray(value.participants) || !isObject(value.my) || !isObject(value.reported)) throw Error('Invalid match rating state');
  return value as unknown as MatchRatingState;
}

/** Rozbieżności między wynikiem a golami i asystami wpisanymi przez zawodników — tylko informacja, gole nadal się liczą. */
export function scoreWarnings(state: Pick<MatchRatingState, 'score' | 'reported'>): string[] {
  const out: string[] = [];
  const { score, reported } = state;
  if (!score) return out;
  for (const [team, label] of [['a', 'A'], ['b', 'B']] as const) {
    const goals = reported[`goals_${team}`], assists = reported[`assists_${team}`], total = score[team];
    if (goals > total) out.push(`Drużyna ${label}: zawodnicy wpisali ${goals} goli, a wynik to ${total}.`);
    if (assists > total) out.push(`Drużyna ${label}: wpisano ${assists} asyst przy ${total} golach.`);
    else if (total > 0 && assists === total) out.push(`Drużyna ${label}: asyst jest tyle samo co goli (${total}) — sprawdź, czy nie było akcji indywidualnych.`);
  }
  return out;
}
