import { RATING_MAX, RATING_MIN, RATING_START, clampRating } from './rating';

/**
 * Rating 0.2 — zatwierdzone przez właściciela 14.11.2026. Źródłem prawdy jest serwer
 * (supabase/migrations/20261114190000_rating_module.sql); ten plik odwzorowuje te same wzory
 * do podglądów i testów. Zmiana tutaj wymaga tej samej zmiany w SQL.
 *
 * - Ocena krocząca: po każdym ocenionym meczu przesuwa się o 10% w stronę średniej ocen z tego meczu.
 * - Premia miesięczna (najwyżej +0,6) dolicza się na stałe; kolejne mecze dalej przesuwają ocenę.
 * - Publicznie 7,00 do czasu 5 ocenionych meczów.
 */
export const RATING_FORMULA_VERSION = '0.2';
export const ROLLING_STEP = 0.1;
export const MIN_BALLOTS_PER_MATCH = 2;
export const MONTHLY_BONUS_MAX = 0.6;
export const BONUS_SPLIT = { mvp: 0.3, goalsAssists: 0.12, action: 0.1, attendance: 0.08 } as const;
/** Pełna premia MVP przy średnio 1 MVP na 2 mecze. */
export const MVP_RATE_FOR_MAX = 0.5;
/** Malejąca korzyść: ok. 63% premii przy 4 golach+asystach na mecz. */
export const GOALS_ASSISTS_SCALE = 4;
export const MIN_SIGNUPS_FOR_ATTENDANCE = 2;

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const unit = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/** Nowa ocena po meczu; bez zmiany, gdy zabrakło ocen od co najmniej dwóch osób. */
export function rollingStep(current: number, ballots: readonly number[]): number {
  const valid = ballots.filter(score => Number.isFinite(score)).map(clampRating);
  if (valid.length < MIN_BALLOTS_PER_MATCH) return current;
  const average = valid.reduce((a, b) => a + b, 0) / valid.length;
  return round3(Math.min(RATING_MAX, Math.max(RATING_MIN, current + ROLLING_STEP * (average - current))));
}

export interface MonthStats {
  played: number; signed: number; reserve: number;
  goals: number; assists: number; mvpUnits: number; actionWins: number;
}

/** Premia za miesiąc: tylko dodatnia, najwyżej +0,6; bez rozegranego meczu brak premii. */
export function monthlyBonus(month: MonthStats): number {
  if (month.played < 1) return 0;
  const signups = month.signed + month.reserve;
  const bonus =
    BONUS_SPLIT.mvp * unit(month.mvpUnits / (month.played * MVP_RATE_FOR_MAX)) +
    BONUS_SPLIT.goalsAssists * (1 - Math.exp(-(Math.max(0, month.goals + month.assists) / month.played) / GOALS_ASSISTS_SCALE)) +
    BONUS_SPLIT.action * unit(month.actionWins / month.played) +
    (signups >= MIN_SIGNUPS_FOR_ATTENDANCE ? BONUS_SPLIT.attendance * unit((month.played + month.reserve) / signups) : 0);
  return Math.min(MONTHLY_BONUS_MAX, Math.max(0, round3(bonus)));
}

export const applyBonus = (current: number, bonus: number): number => round3(Math.min(RATING_MAX, current + Math.max(0, bonus)));
export const initialRating = (): number => RATING_START;
